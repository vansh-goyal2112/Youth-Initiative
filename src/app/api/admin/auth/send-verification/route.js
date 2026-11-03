import { adminAuth } from "@/services/firebaseAdmin";
import { requireAppCheck } from "@/services/appCheckServer";
import { isSaitEmail } from "@/services/adminPermissions";
import { sendAzureEmail } from "@/services/azureEmailServer";
import { cosmosNow, createCosmosDocument, readCosmosDocument, replaceCosmosDocument, isCosmosConflict, isCosmosPreconditionFailed } from "@/services/cosmosData";

export const runtime = "nodejs";
const COOLDOWN_MS = 60_000;
const WINDOW_MS = 3_600_000;
const MAX_PER_WINDOW = 5;

// Firebase creates and validates the verification action link.
// Azure Communication Services sends that link; no Firebase email transport is used.
export async function POST(request) {
  try {
    await requireAppCheck(request);
    const header = request.headers.get("authorization") || "";
    if (!header.startsWith("Bearer ")) {
      return Response.json({ message: "Authentication required." }, { status: 401 });
    }
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(header.slice(7).trim(), true);
    } catch {
      return Response.json({ message: "Invalid authentication." }, { status: 401 });
    }
    if (!isSaitEmail(decoded.email)) {
      return Response.json({ message: "A SAIT email address is required." }, { status: 403 });
    }
    const user = await adminAuth.getUser(decoded.uid);
    const email = user.email?.trim().toLowerCase();
    if (user.disabled || !isSaitEmail(email) ||
        email !== decoded.email.trim().toLowerCase()) {
      return Response.json({ message: "Account identity is invalid." }, { status: 403 });
    }
    if (user.emailVerified) {
      return Response.json({ success: true, verified: true, message: "Email is already verified. Submit your access request." });
    }
    const now = Date.now();
    const id = "admin-verify:" + user.uid;
    const previous = await readCosmosDocument("admins", id);
    const lastSent = Date.parse(previous?.lastSentAt || "") || 0;
    const windowStart = Date.parse(previous?.windowStartedAt || "") || 0;
    const newWindow = !windowStart || now - windowStart >= WINDOW_MS;
    const count = newWindow ? 0 : Number(previous?.sendCount || 0);
    if (now - lastSent < COOLDOWN_MS || count >= MAX_PER_WINDOW) {
      return Response.json({ message: "Email recently sent or request limit reached. Try again later." }, { status: 429 });
    }
    const stamp = cosmosNow();
    const updates = {
      role: "admin_email_verification", status: "pending", email,
      lastSentAt: stamp, windowStartedAt: newWindow ? stamp : previous.windowStartedAt,
      sendCount: count + 1, updatedAt: stamp,
    };
    try {
      if (previous) await replaceCosmosDocument("admins", previous, updates);
      else await createCosmosDocument("admins", { id, ...updates, createdAt: stamp });
    } catch (error) {
      if (isCosmosConflict(error) || isCosmosPreconditionFailed(error)) {
        return Response.json({ message: "Verification request already being processed." }, { status: 429 });
      }
      throw error;
    }

    const verificationLink = await adminAuth.generateEmailVerificationLink(email);
    const result = await sendAzureEmail({
      to: email,
      subject: "Verify your SAIT Youth Initiative administrator email",
      text: "Verify your email using this link (expires automatically): " + verificationLink + "\n\nIf you did not register, ignore this message.",
      html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h1 style="color:#d52731">SAIT Youth Initiative</h1><h2>Verify your administrator email</h2><p>Use the secure link below to verify your SAIT email address. Verification alone does not grant administrator access.</p><p><a href="' +
        verificationLink.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;") +
        '" style="display:inline-block;padding:12px 20px;background:#d52731;color:#fff;text-decoration:none;border-radius:6px">Verify email</a></p><p>If you did not register, ignore this message.</p></div>',
      replyTo: process.env.EMAIL_REPLY_TO || undefined,
    });
    return Response.json({ success: true, message: "Verification email sent using Azure Communication Services.", deliveryId: result?.id || null });
  } catch (error) {
    console.error("Admin email verification delivery failed:", error?.message);
    return Response.json({ message: "Verification email could not be sent. Check Azure Email configuration and try again later." }, { status: 500 });
  }
}
