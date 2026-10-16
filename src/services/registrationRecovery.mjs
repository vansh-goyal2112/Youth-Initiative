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
