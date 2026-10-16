import { randomBytes } from "node:crypto";
import {
  buildRecoveryEmail,
  createRecoveryTokenUpdates,
  nextRecoveryCounter,
  recoveryLimit,
  recoveryRecipient,
  recoveryStage,
} from "./registrationRecovery.mjs";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * A testable application workflow for unfinished registrations. This function
 * never returns the recipient or token. The public API must give identical
 * responses whether an account exists or recovery was skipped.
 *
 * Dependencies are injected so unit/integration tests can run entirely
 * against fake Cosmos records and a captured (never delivered) email.
 */
export async function recoverPendingRegistration({
  email,
  findExistingStudents,
  findPendingRegistrations,
  replaceRegistration,
  sendRecoveryEmail,
  isPreconditionFailed = () => false,
  now = () => Date.now(),
  tokenFactory = () => randomBytes(32).toString("hex"),
  appUrl = "http://localhost:3000",
  replyTo = "youth.programs@sait.ca",
  logError = () => {},
}) {
  const existingStudents = await findExistingStudents(email);
  if (existingStudents.length > 0) return { delivered: false };

  const pending = await findPendingRegistrations(email);
  const registration = pending
    .filter((record) => recoveryStage(record))
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    )[0];

  if (
    !registration ||
    recoveryLimit(registration, now()) ||
    registration.activationInProgress === true ||
    registration.activationRecoveryInProgress === true ||
    registration.emailVerificationResendInProgress === true
  ) {
    return { delivered: false };
  }

  const stage = recoveryStage(registration);
  const recipient = recoveryRecipient(registration);
  if (!recipient) return { delivered: false };

  const token = tokenFactory();
  const currentTime = now();
  const updatedAt = new Date(currentTime).toISOString();
  const updates = {
    ...createRecoveryTokenUpdates(stage, token, currentTime),
    ...nextRecoveryCounter(registration, currentTime),
    registrationRecoveryRequestedAt: updatedAt,
    emailStatus: "sending",
    updatedAt,
  };

  let updated;
  try {
    // Cosmos uses the original document ETag to prevent racing token updates.
    updated = await replaceRegistration(registration, updates);
  } catch (error) {
    if (isPreconditionFailed(error)) return { delivered: false };
    throw error;
  }

  const mail = buildRecoveryEmail(registration, stage, token, appUrl);
  const safeFirstName = escapeHtml(registration.firstName || "Explorer");
  let delivered = false;

  try {
    await sendRecoveryEmail({
      to: [recipient],
      replyTo,
      subject: mail.subject,
      text: `Hello,\n\n${mail.intro}\n\nUse this secure link within 30 minutes:\n${mail.url}\n\nIf you did not request this, ignore this email.\n\nSAIT Youth Initiative`,
      html: `<!doctype html>
        <html lang="en"><body style="margin:0;padding:30px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#24334c;">
          <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:16px;padding:30px;border-top:5px solid #e2232a;">
            <h1 style="font-size:24px;margin:0 0 18px;">Continue Your Youth Initiative Journey</h1>
            <p>Hello ${safeFirstName},</p>
            <p>${escapeHtml(mail.intro)}</p>
            <p style="margin:24px 0;"><a href="${escapeHtml(mail.url)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#e2232a;color:#ffffff;text-decoration:none;font-weight:bold;">${escapeHtml(mail.action)}</a></p>
            <p>This link expires in 30 minutes. If you did not request it, you can ignore this message.</p>
            <p>SAIT Youth Initiative</p>
          </div>
        </body></html>`,
    });
    delivered = true;
  } catch (error) {
    logError("Recovery mail delivery failed:", error);
  }

  try {
    const deliveredAt = new Date(now()).toISOString();
    const finalUpdates = {
      emailStatus: delivered ? "sent" : "failed",
      updatedAt: deliveredAt,
    };
    if (delivered && stage === "parental_consent") {
      finalUpdates.lastConsentEmailSentAt = deliveredAt;
    } else if (delivered && stage === "email_verification") {
      finalUpdates.lastEmailVerificationSentAt = deliveredAt;
    } else if (delivered) {
      finalUpdates.lastActivationRecoverySentAt = deliveredAt;
    }
    await replaceRegistration(updated, finalUpdates);
  } catch (error) {
    // An email may have been sent, so never retry sending here.
    logError("Recovery mail delivery status update failed:", error);
  }

  return { delivered };
}
