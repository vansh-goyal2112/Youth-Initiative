import crypto from "node:crypto";

import { requireAppCheck, appCheckErrorResponse } from "@/services/appCheckServer";
import { sendAzureEmail } from "@/services/azureEmailServer";
import {
  cosmosNow,
  isCosmosPreconditionFailed,
  queryCosmosDocuments,
  replaceCosmosDocument,
} from "@/services/cosmosData";
import {
  normalizeRecoveryEmail,
  recoveryStage,
  recoveryRecipient,
  recoveryLimit,
  nextRecoveryCounter,
} from "@/services/registrationRecovery.mjs";

export const runtime = "nodejs";

const GENERIC_MESSAGE =
  "If an unfinished registration matches that email, we will send a new secure link to the email address already associated with the appropriate verification step. Please check your inbox and spam folder.";

function genericResponse() {
  // Do not reveal whether an email has a pending registration or active account.
  return Response.json({ success: true, message: GENERIC_MESSAGE });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stageEmail(registration, stage, token) {
  const id = encodeURIComponent(registration.id);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  if (stage === "parental_consent") {
    return {
      subject: "Continue Parental Consent – SAIT Youth Initiative",
      url: `${appUrl}/consent/${id}?token=${encodeURIComponent(token)}`,
      intro: "A new parental consent link was requested for an unfinished Youth Initiative registration.",
      action: "Review Parental Consent",
    };
  }

  if (stage === "email_verification") {
    return {
      subject: "Continue Registration – Verify Your Email",
      url: `${appUrl}/verify-email/${id}#token=${encodeURIComponent(token)}`,
      intro: "A new email verification link was requested for an unfinished Youth Initiative registration.",
      action: "Verify My Email",
    };
  }

  return {
    subject: "Continue Youth Initiative Account Setup",
    url: `${appUrl}/set-password/${id}?token=${encodeURIComponent(token)}`,
    intro: "A new account setup link was requested for an approved or verified Youth Initiative registration.",
    action: "Complete Account Setup",
  };
}

function recoveryTokenUpdates(stage, token) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  if (stage === "parental_consent") {
    return { consentTokenHash: hash, consentExpiresAt: expiresAt };
  }
  if (stage === "email_verification") {
    return { emailVerificationTokenHash: hash, emailVerificationExpiresAt: expiresAt };
  }
  return { activationTokenHash: hash, activationExpiresAt: expiresAt };
}

/**
 * Public, App-Check-protected recovery initiation.
 *
 * No registration IDs, pending statuses, guardian emails or new tokens are
 * returned to the caller. Tokens are delivered only to the original trusted
 * email: parent's address for minors and student's address for adults.
 * Existing guardian approval/email verification is never bypassed.
 */
export async function POST(request) {
  try {
    await requireAppCheck(request);

    const body = await request.json().catch(() => null);
    const email = normalizeRecoveryEmail(body?.email);
    if (!email) {
      return Response.json(
        { success: false, message: "Enter a valid email address." },
        { status: 400 }
      );
    }

    // Never recover a stale pending record when an actual student account
    // already exists for this address. Such users use Login/Password Reset.
    const existingStudents = await queryCosmosDocuments(
      "students",
      "SELECT TOP 1 c.id FROM c WHERE c.contactEmail = @email",
      [{ name: "@email", value: email }]
    );

    if (existingStudents.length > 0) {
      return genericResponse();
    }

    const pending = await queryCosmosDocuments(
      "pendingRegistrations",
      `SELECT * FROM c WHERE c.email = @email
       AND c.status IN (
         "pending_email_verification",
         "email_verified",
         "pending_consent",
         "consent_approved"
       )`,
      [{ name: "@email", value: email }]
    );

    const registration = pending
      .filter((record) => recoveryStage(record))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];

    if (!registration || recoveryLimit(registration)) {
      return genericResponse();
    }

    if (
      registration.activationInProgress === true ||
      registration.activationRecoveryInProgress === true ||
      registration.emailVerificationResendInProgress === true ||
      !recoveryRecipient(registration)
    ) {
      return genericResponse();
    }

    const stage = recoveryStage(registration);
    const recipient = recoveryRecipient(registration);
    const token = crypto.randomBytes(32).toString("hex");
    const now = cosmosNow();
    const updates = {
      ...recoveryTokenUpdates(stage, token),
      ...nextRecoveryCounter(registration),
      registrationRecoveryRequestedAt: now,
      emailStatus: "sending",
      updatedAt: now,
    };

    // Conditional ETag write prevents racing an account activation or
    // a simultaneous recovery request from silently overwriting tokens.
    let updated;
    try {
      updated = await replaceCosmosDocument("pendingRegistrations", registration, updates);
    } catch (error) {
      if (isCosmosPreconditionFailed(error)) return genericResponse();
      throw error;
    }

    const mail = stageEmail(registration, stage, token);
    const firstName = escapeHtml(registration.firstName || "Explorer");
    let sent = false;

    try {
      await sendAzureEmail({
        to: [recipient],
        replyTo: process.env.EMAIL_REPLY_TO || "youth.programs@sait.ca",
        subject: mail.subject,
        text: `Hello,\n\n${mail.intro}\n\nUse this secure link within 30 minutes:\n${mail.url}\n\nIf you did not request this, ignore this email.\n\nSAIT Youth Initiative`,
        html: `<!doctype html>
          <html lang="en"><body style="margin:0;padding:30px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#24334c;">
            <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:16px;padding:30px;border-top:5px solid #e2232a;">
              <h1 style="font-size:24px;margin:0 0 18px;">Continue Your Youth Initiative Journey</h1>
              <p>Hello ${firstName},</p>
              <p>${escapeHtml(mail.intro)}</p>
              <p style="margin:24px 0;"><a href="${escapeHtml(mail.url)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#e2232a;color:#ffffff;text-decoration:none;font-weight:bold;">${escapeHtml(mail.action)}</a></p>
              <p>This link expires in 30 minutes. If you did not request it, you can ignore this message.</p>
              <p>SAIT Youth Initiative</p>
            </div>
          </body></html>`,
      });
      sent = true;
    } catch (error) {
      console.error("Pending registration recovery email delivery failed:", error);
    }

    try {
      const deliveredAt = cosmosNow();
      const deliveryUpdates = {
        emailStatus: sent ? "sent" : "failed",
        updatedAt: deliveredAt,
      };
      if (sent && stage === "parental_consent") {
        deliveryUpdates.lastConsentEmailSentAt = deliveredAt;
      } else if (sent && stage === "email_verification") {
        deliveryUpdates.lastEmailVerificationSentAt = deliveredAt;
      } else if (sent) {
        deliveryUpdates.lastActivationRecoverySentAt = deliveredAt;
      }

      await replaceCosmosDocument("pendingRegistrations", updated, deliveryUpdates);
    } catch (error) {
      // The authorization token is already persisted. Do not retry sending
      // automatically or overwrite a registration that changed meanwhile.
      console.error("Registration recovery delivery status update failed:", error);
    }

    return genericResponse();
  } catch (error) {
    const appCheckResponse = appCheckErrorResponse(error);
    if (appCheckResponse) return appCheckResponse;
    console.error("Registration recovery request failed:", error);
    // Even transient backend errors must not reveal account existence.
    return genericResponse();
  }
}
