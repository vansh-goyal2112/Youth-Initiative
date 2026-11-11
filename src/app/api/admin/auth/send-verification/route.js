import { adminAuth } from "@/services/firebaseAdmin";
import { requireAppCheck, appCheckErrorResponse } from "@/services/appCheckServer";
import { isSaitEmail } from "@/services/adminPermissions";
import { sendAzureEmail } from "@/services/azureEmailServer";
import {
  cosmosNow,
  createCosmosDocument,
  readCosmosDocument,
  replaceCosmosDocument,
  isCosmosConflict,
  isCosmosPreconditionFailed,
} from "@/services/cosmosData";

export const runtime = "nodejs";

const COOLDOWN_MS = 60_000;
const WINDOW_MS = 3_600_000;
const MAX_PER_WINDOW = 5;

function safeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Use the same Azure transport, reply-to address, and branded email style
// that already work for student registration. Firebase owns the admin
// verification action: do not mark emailVerified or grant access here.
function verificationEmail(link) {
  return {
    subject: "Verify Your Email - SAIT Youth Initiative",
    replyTo: process.env.EMAIL_REPLY_TO || "youth.programs@sait.ca",
    text:
      "Please verify your SAIT Youth Initiative administrator email address using this secure link:\n" +
      link +
      "\n\nVerification only confirms your email; administrator access still requires approval.\n" +
      "If you did not request an administrator account, ignore this message.",
    html: [
      '<!doctype html><html lang="en"><body style="margin:0;padding:30px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#222">',
      '<div style="max-width:620px;margin:auto;background:#fff;border-radius:14px;padding:32px;border-top:4px solid #e2232a">',
      '<div style="color:#e2232a;font-size:34px;font-weight:900">SAIT</div>',
      '<p style="margin-top:4px;color:#555;font-weight:700">Youth Initiative</p>',
      '<h1>Verify Your Email</h1>',
      '<p>You started creating an administrator account for the SAIT Youth Initiative platform.</p>',
      '<p>Please confirm that this SAIT email address belongs to you before requesting administrator access.</p>',
      '<a href="',
      safeHtml(link),
      '" style="display:inline-block;margin-top:12px;padding:14px 24px;background:#e2232a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Verify Email</a>',
      '<p style="margin-top:24px;color:#777;font-size:13px">Verification does not grant administrator access. An approved Super Admin must review your request.</p>',
      '<p style="color:#777;font-size:13px">If you did not request this account, you can ignore this email.</p>',
      '</div></body></html>',
    ].join(""),
  };
}

export async function POST(request) {
  try {
    await requireAppCheck(request);

    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return Response.json({ success: false, code: "auth-required", message: "Sign in to your SAIT account before requesting verification." }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.slice(7).trim(), true);
    } catch {
      return Response.json({ success: false, code: "session-expired", message: "Your session expired. Sign in again, then request a new verification email." }, { status: 401 });
    }

    if (!isSaitEmail(decoded.email)) {
      return Response.json({ success: false, code: "sait-email-required", message: "Administrator accounts require a verified @sait.ca or @edu.sait.ca email address." }, { status: 403 });
    }

    const user = await adminAuth.getUser(decoded.uid);
    const email = user.email?.trim().toLowerCase();
    if (user.disabled || !isSaitEmail(email) || email !== decoded.email.trim().toLowerCase()) {
      return Response.json({ success: false, code: "identity-invalid", message: "This account's SAIT email does not match your signed-in identity. Sign in again." }, { status: 403 });
    }

    if (user.emailVerified) {
      return Response.json({ success: true, verified: true, code: "already-verified", message: "Your SAIT email is verified. Select Request access to continue." });
    }

    const now = Date.now();
    const id = "admin-verify:" + user.uid;
    const previous = await readCosmosDocument("admins", id);
    const lastAttempt = Date.parse(previous?.lastSentAt || "") || 0;
    const windowStart = Date.parse(previous?.windowStartedAt || "") || 0;
    const newWindow = !windowStart || now - windowStart >= WINDOW_MS;
    const count = newWindow ? 0 : Number(previous?.sendCount || 0);
    const cooldown = Math.max(0, Math.ceil((COOLDOWN_MS - (now - lastAttempt)) / 1000));

    if (cooldown > 0 || count >= MAX_PER_WINDOW) {
      const retryAfterSeconds = cooldown || Math.max(1, Math.ceil((WINDOW_MS - (now - windowStart)) / 1000));
      return Response.json({
        success: false,
        code: "verification-rate-limited",
        message: "Please wait " + retryAfterSeconds + " seconds before requesting another Azure verification email.",
        retryAfterSeconds,
      }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
    }

    const stamp = cosmosNow();
    let attempt;
    const changes = {
      role: "admin_email_verification",
      status: "pending",
      email,
      emailStatus: "sending",
      emailError: null,
      lastSentAt: stamp,
      windowStartedAt: newWindow ? stamp : previous.windowStartedAt,
      sendCount: count + 1,
      updatedAt: stamp,
    };
    try {
      attempt = previous
        ? await replaceCosmosDocument("admins", previous, changes)
        : await createCosmosDocument("admins", { id, ...changes, createdAt: stamp });
    } catch (error) {
      if (isCosmosConflict(error) || isCosmosPreconditionFailed(error)) {
        return Response.json({ success: false, code: "verification-in-progress", message: "Another verification request is being processed. Please try again shortly." }, { status: 429 });
      }
      throw error;
    }

    let stage = "generate-link";
    try {
      const verificationLink = await adminAuth.generateEmailVerificationLink(email);
      stage = "send-email";
      const result = await sendAzureEmail({ to: [email], ...verificationEmail(verificationLink) });
      const operationId = result?.id || null;

      try {
        await replaceCosmosDocument("admins", attempt, {
          emailStatus: "accepted",
          emailId: operationId,
          emailError: null,
          emailSentAt: cosmosNow(),
          updatedAt: cosmosNow(),
        });
      } catch (storageError) {
        // Successful Azure handoff must not be reported as a failed send just
        // because recording its status failed after the fact.
        console.error("Admin verification email status persistence failed:", storageError?.message);
      }

      console.info("Admin verification accepted by Azure", { operationId });
      return Response.json({
        success: true,
        verified: false,
        code: "email-accepted",
        message: "Azure accepted the verification email, but delivery to your SAIT inbox is not confirmed. Check Junk and contact SAIT IT if it does not arrive.",
        deliveryId: operationId,
      }, { status: 202 });
    } catch (error) {
      console.error("Admin verification failed at " + stage + ":", error?.code || error?.message);

      try {
        await replaceCosmosDocument("admins", attempt, {
          emailStatus: "failed",
          emailError: stage === "generate-link" ? "verification-link-failed" : "email-send-failed",
          updatedAt: cosmosNow(),
        });
      } catch (storageError) {
        console.error("Admin verification failure status persistence failed:", storageError?.message);
      }

      const linkFailure = stage === "generate-link";
      return Response.json({
        success: false,
        code: linkFailure ? "verification-link-failed" : "email-send-failed",
        message: linkFailure
          ? "We could not generate your verification link. Please try again shortly or contact the Youth Initiative team."
          : "Azure could not accept the verification email. Your account still exists. Try again after 60 seconds, or select Send with Firebase instead.",
      }, { status: linkFailure ? 500 : 502 });
    }
  } catch (error) {
    const appCheckResponse = appCheckErrorResponse(error);
    if (appCheckResponse) return appCheckResponse;
    console.error("Admin verification request failed:", error?.code || error?.message);
    return Response.json({
      success: false,
      code: "verification-unavailable",
      message: "Verification is temporarily unavailable. Your account has not been deleted. Please try again later or contact the Youth Initiative team.",
    }, { status: 500 });
  }
}
