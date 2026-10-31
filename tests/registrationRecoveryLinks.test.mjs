import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildRecoveryEmail,
  createRecoveryTokenUpdates,
} from "../src/services/registrationRecovery.mjs";

const now = Date.parse("2026-10-16T19:00:00.000Z");
const token = "secret0123456789".repeat(4);
const registration = { id: "registration-12" };
const root = "https://example.test/";

test("adult email verification token is carried in URL fragment, never a query parameter", () => {
  const message = buildRecoveryEmail(registration, "email_verification", token, root);
  const url = new URL(message.url);
  assert.equal(url.pathname, "/verify-email/registration-12");
  assert.equal(url.search, "");
  assert.equal(url.hash, `#token=${token}`);
  assert.match(message.subject, /Verify Your Email/);
});

test("guardian consent links keep the existing consent route and query token", () => {
  const message = buildRecoveryEmail(registration, "parental_consent", token, root);
  const url = new URL(message.url);
  assert.equal(url.pathname, "/consent/registration-12");
  assert.equal(url.searchParams.get("token"), token);
  assert.equal(url.hash, "");
});

test("account setup links use the set-password route with fresh token", () => {
  const message = buildRecoveryEmail(registration, "account_setup", token, root);
  const url = new URL(message.url);
  assert.equal(url.pathname, "/set-password/registration-12");
  assert.equal(url.searchParams.get("token"), token);
});

test("different recovery stages hash tokens into only the appropriate Cosmos field", () => {
  const expectedHash = createHash("sha256").update(token).digest("hex");
  const expiry = new Date(now + 30 * 60 * 1000).toISOString();
  for (const [stage, hashKey, expiryKey] of [
    ["parental_consent", "consentTokenHash", "consentExpiresAt"],
    ["email_verification", "emailVerificationTokenHash", "emailVerificationExpiresAt"],
    ["account_setup", "activationTokenHash", "activationExpiresAt"],
  ]) {
    const updates = createRecoveryTokenUpdates(stage, token, now);
    assert.deepEqual(Object.keys(updates).sort(), [hashKey, expiryKey].sort());
    assert.equal(updates[hashKey], expectedHash);
    assert.equal(updates[expiryKey], expiry);
    assert.doesNotMatch(JSON.stringify(updates), new RegExp(token));
  }
});

test("rotated tokens invalidate the previously stored hash", () => {
  const first = createRecoveryTokenUpdates("parental_consent", token, now);
  const rotated = createRecoveryTokenUpdates("parental_consent", `${token}new`, now + 30_000);
  assert.notEqual(first.consentTokenHash, rotated.consentTokenHash);
  assert.ok(Date.parse(rotated.consentExpiresAt) > Date.parse(first.consentExpiresAt));
});

test("malformed recovery stages and link arguments fail closed", () => {
  assert.throws(() => buildRecoveryEmail(registration, "account_created", token, root));
  assert.throws(() => buildRecoveryEmail({ id: "" }, "account_setup", token, root));
  assert.throws(() => buildRecoveryEmail(registration, "account_setup", "", root));
  assert.throws(() => buildRecoveryEmail(registration, "account_setup", token, "javascript:alert(1)"));
  assert.throws(() => createRecoveryTokenUpdates("unknown", token, now));
  assert.throws(() => createRecoveryTokenUpdates("account_setup", "", now));
  assert.throws(() => createRecoveryTokenUpdates("account_setup", token, Infinity));
});
