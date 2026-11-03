import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeRecoveryEmail,
  nextRecoveryCounter,
  recoveryLimit,
  recoveryRecipient,
  recoveryStage,
} from "../src/services/registrationRecovery.mjs";

const adultPending = {
  id: "reg-adult",
  status: "pending_email_verification",
  emailVerificationStatus: "pending",
  requiresParentalConsent: false,
  email: "student@example.ca",
};
const adultVerified = {
  ...adultPending,
  status: "email_verified",
  emailVerificationStatus: "verified",
};
const minorPending = {
  id: "reg-minor",
  status: "pending_consent",
  consentStatus: "pending",
  requiresParentalConsent: true,
  email: "minor@example.ca",
  parentEmail: "guardian@example.ca",
};
const minorApproved = {
  ...minorPending,
  status: "consent_approved",
  consentStatus: "approved",
};

test("recovery only resumes valid unfinished stages", () => {
  assert.equal(recoveryStage(adultPending), "email_verification");
  assert.equal(recoveryStage(adultVerified), "account_setup");
  assert.equal(recoveryStage(minorPending), "parental_consent");
  assert.equal(recoveryStage(minorApproved), "account_setup");
  assert.equal(recoveryStage({ ...minorPending, consentStatus: "rejected" }), null);
  assert.equal(recoveryStage({ ...minorPending, status: "expired" }), null);
  assert.equal(recoveryStage({ ...adultPending, status: "account_created" }), null);
  assert.equal(recoveryStage({ ...adultPending, firebaseUid: "uid" }), null);
  assert.equal(recoveryStage({ ...adultPending, youthId: "YG-2026" }), null);
});

test("recovery link recipient follows actual trusted ownership", () => {
  assert.equal(recoveryRecipient(adultPending), "student@example.ca");
  assert.equal(recoveryRecipient(adultVerified), "student@example.ca");
  assert.equal(recoveryRecipient(minorPending), "guardian@example.ca");
  assert.equal(recoveryRecipient(minorApproved), "guardian@example.ca");
  assert.equal(recoveryRecipient({ ...minorPending, parentEmail: null }), null);
  assert.equal(recoveryRecipient({ ...minorPending, parentEmail: "invalid" }), null);
  assert.equal(recoveryRecipient({ ...adultPending, email: "STUDENT@EXAMPLE.CA" }), "student@example.ca");
});

test("email is validated without returning or disclosing a registration", () => {
  assert.equal(normalizeRecoveryEmail(" STUDENT@Example.CA "), "student@example.ca");
  assert.equal(normalizeRecoveryEmail("broken-address"), null);
  assert.equal(normalizeRecoveryEmail(""), null);
  assert.equal(normalizeRecoveryEmail(null), null);
  assert.equal(normalizeRecoveryEmail("a".repeat(255) + "@example.ca"), null);
});

test("recovery requests have 60-second cooldown and a five-per-day cap", () => {
  const now = Date.parse("2026-10-16T13:00:00.000Z");
  assert.equal(recoveryLimit({}, now), null);
  assert.equal(recoveryLimit({ registrationRecoveryRequestedAt: new Date(now - 30_000).toISOString() }, now), "cooldown");
  assert.equal(recoveryLimit({ registrationRecoveryRequestedAt: new Date(now - 61_000).toISOString() }, now), null);
  const limited = {
    registrationRecoveryWindowStartedAt: new Date(now - 3_600_000).toISOString(),
    registrationRecoveryCount: 5,
  };
  assert.equal(recoveryLimit(limited, now), "daily_limit");
  assert.equal(recoveryLimit({ ...limited, registrationRecoveryWindowStartedAt: new Date(now - 86_400_001).toISOString() }, now), null);
});

test("recovery counter resets after 24 hours and does not exceed cap", () => {
  const now = Date.parse("2026-10-16T13:00:00.000Z");
  const open = {
    registrationRecoveryCount: 2,
    registrationRecoveryWindowStartedAt: new Date(now - 3_600_000).toISOString(),
  };
  assert.deepEqual(nextRecoveryCounter(open, now), {
    registrationRecoveryCount: 3,
    registrationRecoveryWindowStartedAt: open.registrationRecoveryWindowStartedAt,
  });
  assert.deepEqual(nextRecoveryCounter(open, now + 90_000_000), {
    registrationRecoveryCount: 1,
    registrationRecoveryWindowStartedAt: new Date(now + 90_000_000).toISOString(),
  });
});
