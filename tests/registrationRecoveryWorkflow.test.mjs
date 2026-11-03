import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { recoverPendingRegistration } from "../src/services/registrationRecoveryWorkflow.mjs";

const NOW = Date.parse("2026-10-16T19:00:00.000Z");
const TOKEN = "0123456789abcdef".repeat(4);

const adult = {
  id: "adult-1",
  email: "student@example.ca",
  firstName: "Alex",
  status: "pending_email_verification",
  emailVerificationStatus: "pending",
  requiresParentalConsent: false,
  createdAt: "2026-10-16T18:00:00.000Z",
};
const guardian = {
  id: "minor-1",
  email: "child@example.ca",
  parentEmail: "guardian@example.ca",
  firstName: "Sam",
  status: "pending_consent",
  consentStatus: "pending",
  requiresParentalConsent: true,
  createdAt: "2026-10-16T18:00:00.000Z",
};

function harness(initial, { existingAccount = false, failSend = false, failReplace = false, now = NOW } = {}) {
  let saved = initial ? { ...initial, _etag: "1" } : null;
  const sent = [];
  const writes = [];
  let pendingQueries = 0;

  const dependencies = {
    email: initial?.email || "student@example.ca",
    appUrl: "https://youth.example.ca",
    now: () => now,
    tokenFactory: () => TOKEN,
    findExistingStudents: async () => existingAccount ? [{ id: "active-uid" }] : [],
    findPendingRegistrations: async () => {
      pendingQueries += 1;
      return saved ? [{ ...saved }] : [];
    },
    replaceRegistration: async (previous, updates) => {
      if (failReplace || saved?._etag !== previous._etag) {
        const error = Error("Cosmos conditional write conflict");
        error.code = 412;
        throw error;
      }
      const version = String(Number(saved._etag) + 1);
      saved = { ...saved, ...updates, _etag: version };
      writes.push({ ...updates });
      return { ...saved };
    },
    isPreconditionFailed: (error) => error?.code === 412,
    sendRecoveryEmail: async (message) => {
      if (failSend) throw Error("Simulated Azure email delivery failure");
      sent.push(message);
    },
  };

  return {
    dependencies,
    sent,
    writes,
    get saved() { return saved; },
    get pendingQueries() { return pendingQueries; },
  };
}

test("adult can recover expired verification by replacing link, without resetting registration", async () => {
  const setup = harness({
    ...adult,
    emailVerificationTokenHash: "old-hash",
    emailVerificationExpiresAt: "2026-10-16T18:30:00.000Z",
  });
  const result = await recoverPendingRegistration(setup.dependencies);

  assert.deepEqual(result, { delivered: true });
  assert.equal(setup.sent.length, 1);
  assert.deepEqual(setup.sent[0].to, ["student@example.ca"]);
  assert.match(setup.sent[0].text, /verify-email\/adult-1#token=/);
  assert.equal(setup.saved.id, adult.id);
  assert.equal(setup.saved.status, "pending_email_verification");
  assert.equal(setup.saved.emailVerificationTokenHash, createHash("sha256").update(TOKEN).digest("hex"));
  assert.notEqual(setup.saved.emailVerificationTokenHash, "old-hash");
  assert.ok(!JSON.stringify(setup.saved).includes(TOKEN));
  assert.equal(setup.saved.emailStatus, "sent");
  assert.equal(setup.saved.registrationRecoveryCount, 1);
});

test("adult already verified can recover account setup without repeating verification", async () => {
  const setup = harness({ ...adult, status: "email_verified", emailVerificationStatus: "verified" });
  const result = await recoverPendingRegistration(setup.dependencies);

  assert.equal(result.delivered, true);
  assert.match(setup.sent[0].text, /set-password\/adult-1\?token=/);
  assert.equal(setup.saved.status, "email_verified");
  assert.ok(setup.saved.activationTokenHash);
  assert.equal(setup.saved.emailVerificationStatus, "verified");
});

test("minor consent recovery always emails existing parent and retains pending state", async () => {
  const setup = harness(guardian);
  const result = await recoverPendingRegistration(setup.dependencies);

  assert.deepEqual(result, { delivered: true });
  assert.deepEqual(setup.sent[0].to, ["guardian@example.ca"]);
  assert.ok(!setup.sent[0].to.includes("child@example.ca"));
  assert.match(setup.sent[0].text, /consent\/minor-1\?token=/);
  assert.equal(setup.saved.status, "pending_consent");
  assert.equal(setup.saved.consentStatus, "pending");
  assert.equal(setup.saved.guardianConfirmed, undefined);
});

test("guardian-approved account setup recovers only through existing guardian", async () => {
  const setup = harness({ ...guardian, status: "consent_approved", consentStatus: "approved", guardianConfirmed: true });
  const result = await recoverPendingRegistration(setup.dependencies);

  assert.equal(result.delivered, true);
  assert.deepEqual(setup.sent[0].to, ["guardian@example.ca"]);
  assert.match(setup.sent[0].text, /set-password\/minor-1\?token=/);
  assert.equal(setup.saved.consentStatus, "approved");
});

test("active account prevents lookup and emailing a stale pending record", async () => {
  const setup = harness(guardian, { existingAccount: true });
  assert.deepEqual(await recoverPendingRegistration(setup.dependencies), { delivered: false });
  assert.equal(setup.pendingQueries, 0);
  assert.equal(setup.sent.length, 0);
  assert.equal(setup.writes.length, 0);
});

test("no matching record, completed record, and missing guardian don't send", async () => {
  for (const record of [
    null,
    { ...adult, status: "account_created" },
    { ...guardian, parentEmail: null },
    { ...guardian, firebaseUid: "already-active" },
  ]) {
    const setup = harness(record);
    assert.deepEqual(await recoverPendingRegistration(setup.dependencies), { delivered: false });
    assert.equal(setup.sent.length, 0);
    assert.equal(setup.writes.length, 0);
  }
});

test("cooldown and daily quota both block repeated delivery", async () => {
  const recent = harness({ ...adult, registrationRecoveryRequestedAt: new Date(NOW - 10_000).toISOString() });
  assert.equal((await recoverPendingRegistration(recent.dependencies)).delivered, false);

  const capped = harness({
    ...adult,
    registrationRecoveryCount: 5,
    registrationRecoveryWindowStartedAt: new Date(NOW - 3_600_000).toISOString(),
  });
  assert.equal((await recoverPendingRegistration(capped.dependencies)).delivered, false);
  assert.equal(recent.sent.length + capped.sent.length, 0);
});

test("activation/resend locks and ETag collisions are safe, without email", async () => {
  for (const flag of ["activationInProgress", "activationRecoveryInProgress", "emailVerificationResendInProgress"]) {
    const setup = harness({ ...adult, [flag]: true });
    assert.equal((await recoverPendingRegistration(setup.dependencies)).delivered, false);
    assert.equal(setup.sent.length, 0);
  }
  const conflict = harness(adult, { failReplace: true });
  assert.equal((await recoverPendingRegistration(conflict.dependencies)).delivered, false);
  assert.equal(conflict.sent.length, 0);
});

test("concurrent requests do not send two recovery emails", async () => {
  const setup = harness(adult);
  const results = await Promise.all([
    recoverPendingRegistration(setup.dependencies),
    recoverPendingRegistration(setup.dependencies),
  ]);
  assert.equal(results.filter((entry) => entry.delivered).length, 1);
  assert.equal(setup.sent.length, 1);
  assert.equal(setup.writes.length, 2);
});

test("email failure is recorded, but secret tokens never appear in result", async () => {
  const setup = harness(adult, { failSend: true });
  const result = await recoverPendingRegistration(setup.dependencies);

  assert.deepEqual(result, { delivered: false });
  assert.equal(setup.sent.length, 0);
  assert.equal(setup.saved.emailStatus, "failed");
  assert.equal(setup.saved.registrationRecoveryCount, 1);
  assert.ok(!JSON.stringify(setup.saved).includes(TOKEN));
});

test("email markup escapes untrusted registration display names", async () => {
  const setup = harness({ ...guardian, firstName: "<script>alert('x')</script>" });
  const result = await recoverPendingRegistration(setup.dependencies);

  assert.equal(result.delivered, true);
  assert.doesNotMatch(setup.sent[0].html, /<script>/);
  assert.match(setup.sent[0].html, /&lt;script&gt;/);
});

test("prefer the most recently created valid registration", async () => {
  const setup = harness(adult);
  setup.dependencies.findPendingRegistrations = async () => [
    { ...adult, id: "older", createdAt: "2026-10-10T10:00:00.000Z" },
    { ...adult, id: "newer", createdAt: "2026-10-16T10:00:00.000Z" },
  ];
  // The test adapter persists a single document; verify that an older
  // candidate cannot be picked over the latest one.
  const selected = [];
  setup.dependencies.replaceRegistration = async (record, updates) => {
    selected.push(record.id);
    return { ...record, ...updates };
  };
  await recoverPendingRegistration(setup.dependencies);
  assert.equal(selected[0], "newer");
});
