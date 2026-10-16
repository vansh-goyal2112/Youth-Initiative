import { createHash } from "node:crypto";

export const RECOVERABLE_STATES = Object.freeze({
  pending_email_verification: "email_verification",
  email_verified: "account_setup",
  pending_consent: "parental_consent",
  consent_approved: "account_setup",
});

export function recoveryStage(registration) {
  if (!registration || registration.firebaseUid || registration.youthId) return null;
  if (registration.requiresParentalConsent === true) {
    if (registration.status === "pending_consent" && registration.consentStatus === "pending") {
      return "parental_consent";
    }
    if (registration.status === "consent_approved" && registration.consentStatus === "approved") {
      return "account_setup";
    }
    return null;
  }
  if (registration.status === "pending_email_verification" && registration.emailVerificationStatus === "pending") {
    return "email_verification";
  }
  if (registration.status === "email_verified" && registration.emailVerificationStatus === "verified") {
    return "account_setup";
  }
  return null;
}

export function recoveryRecipient(registration) {
  if (!recoveryStage(registration)) return null;
  const address = registration.requiresParentalConsent === true
    ? registration.parentEmail
    : registration.email;
  if (typeof address !== "string") return null;
  const normalized = address.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function normalizeRecoveryEmail(email) {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function recoveryLimit(registration, now = Date.now()) {
  const last = Date.parse(registration?.registrationRecoveryRequestedAt || "");
  if (Number.isFinite(last) && now >= last && now - last < 60 * 1000) {
    return "cooldown";
  }
  const started = Date.parse(registration?.registrationRecoveryWindowStartedAt || "");
  const withinWindow = Number.isFinite(started) && now >= started && now - started < 24 * 60 * 60 * 1000;
  if (withinWindow && (registration?.registrationRecoveryCount || 0) >= 5) {
    return "daily_limit";
  }
  return null;
}

export function nextRecoveryCounter(registration, now = Date.now()) {
  const started = Date.parse(registration?.registrationRecoveryWindowStartedAt || "");
  const active = Number.isFinite(started) && now >= started && now - started < 24 * 60 * 60 * 1000;
  return {
    registrationRecoveryCount: active ? (Number(registration?.registrationRecoveryCount) || 0) + 1 : 1,
    registrationRecoveryWindowStartedAt: active ? registration.registrationRecoveryWindowStartedAt : new Date(now).toISOString(),
  };
}

/**
 * Pure stage-specific message/link builder.  Verify and consent links retain
 * their existing token transport rules (#fragment for adult email verification,
 * ?query for consent and activation).
 */
export function buildRecoveryEmail(registration, stage, token, baseUrl) {
  if (
    !registration?.id ||
    !["parental_consent", "email_verification", "account_setup"].includes(stage) ||
    typeof token !== "string" ||
    !token ||
    typeof baseUrl !== "string" ||
    !/^https?:\/\//.test(baseUrl)
  ) {
    throw new Error("Invalid registration recovery link parameters.");
  }

  const root = baseUrl.replace(/\/+$/, "");
  const id = encodeURIComponent(registration.id);
  const encodedToken = encodeURIComponent(token);

  switch (stage) {
    case "parental_consent":
      return {
        subject: "Continue Parental Consent – SAIT Youth Initiative",
        url: `${root}/consent/${id}?token=${encodedToken}`,
        intro: "A new parental consent link was requested for an unfinished Youth Initiative registration.",
        action: "Review Parental Consent",
      };

    case "email_verification":
      return {
        subject: "Continue Registration – Verify Your Email",
        url: `${root}/verify-email/${id}#token=${encodedToken}`,
        intro: "A new email verification link was requested for an unfinished Youth Initiative registration.",
        action: "Verify My Email",
      };

    default:
      return {
        subject: "Continue Youth Initiative Account Setup",
        url: `${root}/set-password/${id}?token=${encodedToken}`,
        intro: "A new account setup link was requested for an approved or verified Youth Initiative registration.",
        action: "Complete Account Setup",
      };
  }
}

/** No plaintext token is written to Cosmos. Use an injectable clock in tests. */
export function createRecoveryTokenUpdates(stage, token, now = Date.now()) {
  if (
    !["parental_consent", "email_verification", "account_setup"].includes(stage) ||
    typeof token !== "string" ||
    !token ||
    !Number.isFinite(now)
  ) {
    throw new Error("Invalid recovery token parameters.");
  }

  const hash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();

  switch (stage) {
    case "parental_consent":
      return { consentTokenHash: hash, consentExpiresAt: expiresAt };
    case "email_verification":
      return { emailVerificationTokenHash: hash, emailVerificationExpiresAt: expiresAt };
    default:
      return { activationTokenHash: hash, activationExpiresAt: expiresAt };
  }
}
