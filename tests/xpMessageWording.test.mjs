import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("XP messages do not promise fixed rewards", () => {
  const paths = [
    "../src/app/page.js",
    "../src/app/profile/page.js",
    "../src/app/tasks/page.js",
    "../src/components/common/StudentAnnouncements.jsx",
    "../src/components/common/WelcomeTutorial.jsx",
    "../src/components/workshops/SelfReportWorkshop.jsx",
    "../src/app/api/feedback/route.js",
  ];
  for (const path of paths) {
    const content = read(path);
    assert.doesNotMatch(content, /(?:\+?\b(?:20|50|75|100)\b(?:\s+bonus)?\s+XP)/i, path);
  }
  assert.match(read("../src/app/tasks/page.js"), /Submit & Earn XP/);
  assert.match(read("../src/components/workshops/SelfReportWorkshop.jsx"), /Earn <strong>XP<\/strong>/);
});

test("real XP values stay on workshop cards and counters", () => {
  assert.match(read("../src/components/workshops/WorkshopCard.js"), /workshop\.xpReward/);
  assert.match(read("../src/app/workshops/[id]/page.js"), /workshop\.xpReward/);
  assert.match(read("../src/app/reward/page.js"), /reward\.xpEarned/);
  assert.match(read("../src/app/journey/page.js"), /gameData\.totalXp/);
  // Fixed feedback points remain a business rule. Only the response wording changed.
  assert.match(read("../src/app/api/feedback/route.js"), /pointsAwarded:WORKSHOP_FEEDBACK_XP/);
});
