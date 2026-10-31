import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyRewardRecovery,
  shouldShowQuestAsRewarded,
} from "../src/services/rewardRecovery.mjs";

const verified = {
  id: "registration-1",
  workshopId: "workshop-1",
  status: "completed",
  attendanceStatus: "verified",
  completionXpAwarded: false,
};

test("only completed registrations with verified attendance qualify", () => {
  assert.equal(classifyRewardRecovery(null, null), "ineligible");
  assert.equal(
    classifyRewardRecovery({ ...verified, status: "upcoming" }, null),
    "ineligible"
  );
  assert.equal(
    classifyRewardRecovery({ ...verified, attendanceStatus: "pending" }, null),
    "ineligible"
  );
  assert.equal(
    classifyRewardRecovery({ ...verified, workshopId: "" }, null),
    "ineligible"
  );
});

test("a verified completion without a transaction can be awarded once", () => {
  assert.equal(classifyRewardRecovery(verified, null), "award");
  // Old registrations could have had this flag set before rewards succeeded.
  assert.equal(
    classifyRewardRecovery({ ...verified, completionXpAwarded: true }, null),
    "award"
  );
});

test("a completed transaction allows synchronization, never a second award", () => {
  assert.equal(
    classifyRewardRecovery(verified, { status: "completed" }),
    "synchronize"
  );
});

test("a processing or unknown transaction needs review, not more XP", () => {
  assert.equal(
    classifyRewardRecovery(verified, { status: "processing" }),
    "pending"
  );
  assert.equal(
    classifyRewardRecovery(verified, { status: "unrecognized" }),
    "pending"
  );
});

test("quest completion status is based on actual progress", () => {
  assert.equal(shouldShowQuestAsRewarded({ completed: true }), true);
  assert.equal(shouldShowQuestAsRewarded({ completed: false }), false);
  assert.equal(shouldShowQuestAsRewarded(null), false);
});
