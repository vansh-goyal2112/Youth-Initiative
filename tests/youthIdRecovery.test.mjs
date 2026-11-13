import test from "node:test";
import assert from "node:assert/strict";
import { selectRecoverableYouthIds, youthIdRecoveryPlainText } from "../src/services/youthIdRecovery.mjs";
const adult = { id: "adult", role: "student", accountStatus: "active", youthId: "Y123",
  firstName: "Alice", contactEmail: "ALICE@EXAMPLE.COM", contactEmailVerified: true,
  requiresParentalConsent: false };
const minor = { id: "minor", role: "student", accountStatus: "active", youthId: "Y456",
  firstName: "Bob", contactEmail: "bob@example.com", contactEmailVerified: false,
  parentEmail: "PARENT@EXAMPLE.COM", requiresParentalConsent: true, consentStatus: "approved" };
test("case-insensitive matching recovers only the same verified adult mailbox", () => {
  assert.deepEqual(selectRecoverableYouthIds({
    requestedEmail: " alice@example.com ", contactEmailStudents: [adult],
  }), [{firstName: "Alice", youthId: "Y123"}]);
  assert.deepEqual(selectRecoverableYouthIds({
    requestedEmail: "other@example.com", contactEmailStudents: [adult],
  }), []);
});
test("minor recovery routes only through the approved guardian, never the student's unverified email", () => {
  assert.deepEqual(selectRecoverableYouthIds({
    requestedEmail: "parent@example.com", parentEmailStudents: [minor, minor],
  }), [{firstName: "Bob", youthId: "Y456"}]);
  assert.deepEqual(selectRecoverableYouthIds({
    requestedEmail: "bob@example.com", contactEmailStudents: [{...minor, contactEmailVerified: true}],
  }), []);
  assert.deepEqual(selectRecoverableYouthIds({
    requestedEmail: "parent@example.com", parentEmailStudents: [{...minor, consentStatus: "pending"}],
  }), []);
});
test("no recovery for inactive students, unverified adults, or mismatched emails", () => {
  assert.deepEqual(selectRecoverableYouthIds({
    requestedEmail: "alice@example.com", contactEmailStudents: [
      {...adult, accountStatus: "inactive"}, {...adult, contactEmailVerified: false},
    ],
  }), []);
});
test("Youth ID recovery includes readable plain-text alternative for email clients", () => {
  const msg = youthIdRecoveryPlainText([{firstName: "Alice", youthId: "Y123"}], "https://example.com");
  assert.match(msg, /SAIT Youth Initiatives/);
  assert.match(msg, /Alice: Y123/);
  assert.match(msg, /https:\/\/example.com\/login/);
});
