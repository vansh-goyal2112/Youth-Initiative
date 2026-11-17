import test from "node:test";
import assert from "node:assert/strict";
import { awardForCompletion, completionTransactionId } from "../src/services/completionRules.mjs";
import { creditXp, reverseEarnedXp } from "../src/services/xpBalance.mjs";
import { calculateLevel, getLevelInformation, getLevelName } from "../src/services/levelProgress.mjs";
import { countMatchingSessions } from "../src/services/customBadges.mjs";
import { workshopCompletionSnapshot } from "../src/services/workshopHistory.mjs";

test("175 XP + 100 XP means 275 Total XP and Level 3, not 200", () => {
  const robotics = { id: "robotics", xpReward: 175, title: "Robotics", category: "Technology" };
  const coding = { id: "coding", xpReward: 100, title: "Coding", category: "Technology" };
  let student = { totalXp: 0, currentXp: 0 };
  const first = awardForCompletion(robotics, "qr");
  assert.equal(first, 175);
  student = creditXp(student, first);
  assert.equal(student.totalXp, 175);
  assert.equal(calculateLevel(student.totalXp), 2);
  const second = awardForCompletion(coding, "qr");
  student = creditXp(student, second);
  assert.equal(second, 100);
  assert.deepEqual(student, { totalXp: 275, currentXp: 275, xpCorrectionDebt: 0 });
  assert.equal(calculateLevel(student.totalXp), 3);
  assert.equal(getLevelName(3), "Future Creator");
  assert.equal(getLevelInformation(student.totalXp).level, 3);
  assert.equal(getLevelInformation(student.totalXp).nextXp, 450);
});

test("self-report credits half of the workshop's actual configured XP", () => {
  const first = awardForCompletion({ xpReward: 175 }, "self_reported");
  assert.equal(first, 87);
  const next = awardForCompletion({ xpReward: 100 }, "qr");
  const student = creditXp(creditXp({ totalXp: 0, currentXp: 0 }, first), next);
  assert.equal(student.totalXp, 187);
  assert.equal(getLevelInformation(student.totalXp).level, 2);
});

test("badge rules count completed workshops, not a fixed 100 XP per workshop", () => {
  const rule = { type: "sessions_topic", matchValue: "robotics", minCount: 3 };
  const records = [175, 100, 50].map((xpReward, index) => ({
    id: "r" + index,
    status: "completed",
    workshopSnapshot: { title: "Robotics Workshop", xpReward },
  }));
  assert.equal(countMatchingSessions(rule, records.slice(0, 2)), 2);
  assert.equal(countMatchingSessions(rule, records), 3);
});

test("saved workshop history and duplicate award IDs honor the assigned XP", () => {
  const workshop = { id: "robotics", title: "Robotics", xpReward: 175, category: "Technology" };
  const snapshot = workshopCompletionSnapshot(workshop, { id: "reg", workshopId: "robotics", status: "completed" }, null);
  assert.equal(snapshot.xpReward, 175);
  assert.equal(completionTransactionId("student", "robotics"), completionTransactionId("student", "robotics"));
  assert.notEqual(completionTransactionId("student", "robotics"), completionTransactionId("student", "coding"));
});

test("reversing an actual 175 XP completion removes 175, not 100", () => {
  const state = { totalXp: 275, currentXp: 275 };
  const reversed = reverseEarnedXp(state, 175);
  assert.equal(reversed.totalXp, 100);
  assert.equal(reversed.currentXp, 100);
  assert.equal(getLevelInformation(reversed.totalXp).level, 2);
});
