import test from "node:test";
import assert from "node:assert/strict";

import {
  getReflectionStats,
  isValidQuestId,
  validateReflection,
  QUEST_IDS,
  REFLECTION_MOODS,
  LEARNING_MOMENTS,
} from "../src/services/skillQuestEngagement.mjs";

const verified = (id, reflection = null) => ({
  id,
  workshopId: "workshop-" + id,
  studentId: "student-1",
  status: "completed",
  attendanceStatus: "verified",
  completedAt: "2026-10-16T16:00:00.000Z",
  workshop: { title: "Robotics workshop" },
  reflection,
});

test("only known missions can be selected", () => {
  assert.equal(QUEST_IDS.length, 5);
  for (const questId of QUEST_IDS) assert.equal(isValidQuestId(questId), true);
  assert.equal(isValidQuestId("hack-admin"), false);
  assert.equal(isValidQuestId(null), false);
});

test("reflection must use exactly one allowed feeling and learning moment", () => {
  for (const mood of REFLECTION_MOODS) {
    for (const moment of LEARNING_MOMENTS) {
      assert.equal(validateReflection({ mood: mood.id, moment: moment.id }), true);
    }
  }
  assert.equal(validateReflection({ mood: "unknown", moment: "solved" }), false);
  assert.equal(validateReflection({ mood: "curious", moment: "unknown" }), false);
  assert.equal(validateReflection({ mood: "", moment: "" }), false);
  assert.equal(validateReflection({ mood: ["proud"], moment: "tried" }), false);
});

test("only verified attendance counts toward learning journal progress", () => {
  const all = [
    verified("first", { mood: "proud", moment: "created", completedAt: "2026-10-16T17:00:00.000Z" }),
    verified("second"),
    { ...verified("not-verified"), attendanceStatus: "pending" },
    { ...verified("not-completed"), status: "upcoming" },
    { ...verified("missing-workshop"), workshopId: null },
  ];
  const stats = getReflectionStats(all);
  assert.equal(stats.completedCount, 2);
  assert.equal(stats.reflectedCount, 1);
  assert.equal(stats.pending.length, 1);
  assert.equal(stats.pending[0].id, "second");
  assert.equal(stats.recent[0].id, "first");
});

test("empty input has no reflections or pending requests", () => {
  assert.deepEqual(getReflectionStats(), {
    completedCount: 0,
    reflectedCount: 0,
    pending: [],
    recent: [],
  });
});
