import assert from "node:assert/strict";
import test from "node:test";
import { completionTransactionId, awardForCompletion } from "../src/services/completionRules.mjs";

test("retains old QR transaction keys without sessions", () => {
  assert.equal(completionTransactionId("student", "workshop"), "student_workshop");
});
test("different scheduled sessions earn distinct transaction keys", () => {
  assert.notEqual(completionTransactionId("student", "workshop", "A"), completionTransactionId("student", "workshop", "B"));
});
test("self reported attendance awards half XP, rounded down to a whole XP", () => {
  assert.equal(awardForCompletion({ xpReward: 100 }, "self_reported"), 50);
  assert.equal(awardForCompletion({ xpReward: 75 }, "self_reported"), 37);
  assert.equal(awardForCompletion({ xpReward: 100 }, "qr"), 100);
});
test("rejects unknown award sources", () => {
  assert.throws(() => awardForCompletion({ xpReward: 100 }, "invented"));
});
