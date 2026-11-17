import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const visible = [
  "../src/components/gamification/SkillQuestHub.jsx",
  "../src/components/gamification/JournalStamps.jsx",
  "../src/app/dashboard/page.js",
  "../src/app/journey/page.js",
  "../src/components/gamification/AdventureTrail.jsx",
  "../src/app/page.js",
];

test("student pages use XP, levels and badges instead of overlapping progress jargon", () => {
  for (const path of visible) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    // Only match text labels; internal source identifiers such as skillTracks
    // and CSS class names are deliberately unchanged for data compatibility.
    assert.doesNotMatch(source, /\b(?:Skill Tracks?|Skill XP|Journal Stamps?|Quests Reached|Choose Your Mission|MY ACTIVE MISSION|MAKE IT YOUR QUEST)\b/i, path);
  }
  const journey = readFileSync(new URL("../src/app/journey/page.js", import.meta.url), "utf8");
  assert.match(journey, /Workshops by Area/);
  assert.match(journey, /\{track\.xp\} XP/);
  const map = readFileSync(new URL("../src/components/gamification/AdventureTrail.jsx", import.meta.url), "utf8");
  assert.match(map, /Your Adventure Map/);
  assert.doesNotMatch(map, /XP earned through verified learning/);
});

test("selection and reflection responses use plain wording without changing stored IDs", () => {
  const focus = readFileSync(new URL("../src/app/api/gamification/focus/route.js", import.meta.url), "utf8");
  assert.match(focus, /activeQuestId: questId/);
  assert.match(focus, /Saved! Your workshop interests are updated/);
  const reflect = readFileSync(new URL("../src/app/api/gamification/reflect/route.js", import.meta.url), "utf8");
  assert.match(reflect, /Your workshop reflection was saved/);
});
