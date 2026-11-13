import { createHash } from "node:crypto";
import { adminAuth } from "@/services/firebaseAdmin";
import { requireAppCheck, appCheckErrorResponse } from "@/services/appCheckServer";
import { sendAzureEmail } from "@/services/azureEmailServer";
import { isSaitEmail } from "@/services/adminPermissions";
import { adminResetActionUrl } from "@/services/adminPasswordRecovery.mjs";
import {
  cosmosNow, createCosmosDocument, readCosmosDocument, replaceCosmosDocument,
  isCosmosConflict, isCosmosPreconditionFailed,
} from "@/services/cosmosData";

export const runtime = "nodejs";
const COOLDOWN_MS = 60_000;
const WINDOW_MS = 3_600_000;
const MAX_PER_WINDOW = 5;

// Always return the same message whether an address is unknown, unapproved,
// throttled or its mailbox rejects delivery; never reveal staff account status.
const MESSAGE = "If this email belongs to a registered SAIT administrator, password-reset instructions will be sent. Check Inbox/Junk. If nothing arrives, ask SAIT IT to check your mailbox's message trace.";
function reply() {
  return Response.json({ success: true, message: MESSAGE }, {
    status: 202, headers: { "Cache-Control": "no-store" },
  });
}
function safeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function resetEmail(link) {
  return {
    subject: "Reset Your Admin Password – SAIT Youth Initiatives",
    replyTo: process.env.EMAIL_REPLY_TO || "youth.programs@sait.ca",
    text: [
      "You requested a password reset for your SAIT Youth Initiatives administrator account.",
      "Open this one-time Firebase-authorized link to create a new password:",
      link,
      "",
      "This link can be used only once. If you did not request a reset, ignore this email.",
      "Resetting your password does not remove your admin access restrictions or authenticator requirement.",
    ].join("\n"),
    html: [
      '<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#24334c;background:#f4f6fb;padding:30px">',
      '<div style="max-width:620px;margin:auto;background:#fff;padding:28px;border-radius:16px;border-top:5px solid #e2232a">',
      '<h1 style="font-size:24px">SAIT Youth Initiatives</h1><h2>Reset your administrator password</h2>',
      '<p>Use the one-time link below to set a new password for your admin account.</p>',
      '<p><a href="', safeHtml(link),
      '" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#c52d36;color:#fff;text-decoration:none;font-weight:700">Reset Password</a></p>',
      '<p style="font-size:13px;color:#64748b">If you did not request this reset, ignore this message. Password changes do not bypass admin approval or authenticator verification.</p>',
      '</div></body></html>',
    ].join(""),
  };
}

export async function POST(request) {
  try {
    // Unauthenticated recovery must be protected against replayed App Check
    // tokens and mass automated requests.
    await requireAppCheck(request, { consume: true });
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string"
      ? body.email.trim().toLowerCase() : "";
    if (!isSaitEmail(email) || email.length > 254) {
      return Response.json({ success: false, message: "Enter your valid @sait.ca or @edu.sait.ca email address." }, { status: 400 });
    }

    // Rate-limit all supplied SAIT addresses, whether or not they are accounts.
    const id = "admin-recovery:" + createHash("sha256").update(email).digest("hex");
    const previous = await readCosmosDocument("admins", id);
    const now = Date.now();
    const lastSentAt = Date.parse(previous?.lastSentAt || "") || 0;
    const windowStartedAt = Date.parse(previous?.windowStartedAt || "") || 0;
    const newWindow = !windowStartedAt || now - windowStartedAt > WINDOW_MS;
    const count = newWindow ? 0 : Number(previous?.sendCount || 0);
    if (now - lastSentAt < COOLDOWN_MS || count >= MAX_PER_WINDOW) return reply();

    const stamp = cosmosNow();
    const changes = {
      role: "admin_password_recovery_rate",
      windowStartedAt: newWindow ? stamp : previous.windowStartedAt,
      lastSentAt: stamp,
      sendCount: count + 1,
      updatedAt: stamp,
    };
    let record;
    try {
      record = previous
        ? await replaceCosmosDocument("admins", previous, changes)
        : await createCosmosDocument("admins", { id, ...changes, createdAt: stamp });
    } catch (error) {
      if (isCosmosConflict(error) || isCosmosPreconditionFailed(error)) return reply();
      throw error;
    }

    try {
      const user = await adminAuth.getUserByEmail(email).catch(error => {
        if (error.code === "auth/user-not-found") return null;
        throw error;
      });
      // Only existing admin applicants/administrators can use this admin-
      // branded route. This never creates or activates an account.
      if (!user || user.disabled) return reply();
      const admin = await readCosmosDocument("admins", user.uid);
      if (!admin || admin.role !== "admin" ||
          !["active", "pending"].includes(admin.status) ||
          admin.email?.trim().toLowerCase() !== email) return reply();

      const actionLink = await adminAuth.generatePasswordResetLink(email);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const link = adminResetActionUrl(actionLink, appUrl);
      const delivery = await sendAzureEmail({ to: [email], ...resetEmail(link) });
      try {
        await replaceCosmosDocument("admins", record, {
          lastEmailStatus: "accepted", lastEmailId: delivery.id || null,
          updatedAt: cosmosNow(),
        });
      } catch (error) {
        console.error("Admin password-reset send status could not be recorded:", error?.code || error?.message);
      }
    } catch (error) {
      // Keep public response generic to avoid account enumeration. The
      // Public response remains generic even if Azure delivery fails.
      console.error("Admin password-reset delivery failed:", error?.code || error?.message);
    }
    return reply();
  } catch (error) {
    const denied = appCheckErrorResponse(error);
    if (denied) return denied;
    console.error("Admin password-reset request unavailable:", error?.code || error?.message);
    return Response.json({ success: false, message: "Password recovery is temporarily unavailable. Please try again later or contact SAIT IT." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
