import test from "node:test";
import assert from "node:assert/strict";
import { auditFieldChanges, WORKSHOP_AUDIT_FIELDS } from "../src/services/adminAuditChanges.mjs";

test("workshop change summaries show XP values while omitting link and description contents", () => {
  const before = { title: "Intro to Robotics", xpReward: 100, description: "old text", registrationUrl: "old link" };
  const after = { ...before, xpReward: 175, description: "new text", registrationUrl: "new link", updatedBy: "admin-id" };
  assert.deepEqual(auditFieldChanges(before, after, WORKSHOP_AUDIT_FIELDS), [
    "XP reward changed from 100 to 175", "Description changed", "Registration link changed",
  ]);
  assert.deepEqual(auditFieldChanges(after, { ...after, updatedAt: "today" }, WORKSHOP_AUDIT_FIELDS), []);
});
