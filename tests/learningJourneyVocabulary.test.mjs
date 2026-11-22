import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const visible = [
  "../src/components/gamification/SkillQuestHub.jsx",
  "../src/app/dashboard/page.js",
  "../src/app/journey/page.js",
  "../src/components/gamification/AdventureTrail.jsx",
  "../src/app/LandingPage.jsx",
];

test("student pages use XP, levels and badges instead of overlapping progress jargon", () => {
  for (const path of visible) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    // Only match text labels; internal source identifiers such as skillTracks
    // and CSS class names are deliberately unchanged for data compatibility.
    assert.doesNotMatch(source, /\b(?:Skill Tracks?|Skill XP|Journal Stamps?|Quests Reached|Choose Your Mission|MY ACTIVE MISSION|MAKE IT YOUR QUEST)\b/i, path);
  }
  const journey = readFileSync(new URL("../src/app/journey/page.js", import.meta.url), "utf8");
  const home = readFileSync(new URL("../src/app/dashboard/page.js", import.meta.url), "utf8");
  assert.doesNotMatch(home, /Workshops by Area|dashboard-skills-section|gameData\.skillTracks/);
  // Journey prioritizes next steps and the badge page reads catalogue progress.
  assert.match(journey, /Recommended experiences/);
  assert.match(journey, /Future pathways \(SAIT programs\)/);
  assert.match(journey, /Upcoming at SAIT/);
  assert.match(journey, /AdventureTrail/);
  assert.match(journey, /See my badges/);
  assert.doesNotMatch(journey, /Workshops by Area|skill-track-section|SkillTrackCard/);
  const badges = readFileSync(new URL("../src/app/badges/page.js", import.meta.url), "utf8");
  const progressApi = readFileSync(new URL("../src/app/api/gamification/route.js", import.meta.url), "utf8");
  assert.match(badges, /gameData\.badgeCatalog/);
  assert.match(progressApi, /current: countMatchingSessions\(definition\.rule, completedWithSnapshots\)/);
  assert.match(progressApi, /skillTracks,/);
  const map = readFileSync(new URL("../src/components/gamification/AdventureTrail.jsx", import.meta.url), "utf8");
  assert.match(map, /Your Adventure Map/);
  assert.doesNotMatch(map, /XP earned through verified learning/);
});

test("selection response uses plain wording without changing stored IDs", () => {
  const focus = readFileSync(new URL("../src/app/api/gamification/focus/route.js", import.meta.url), "utf8");
  assert.match(focus, /activeQuestId: questId/);
  assert.match(focus, /Saved! Your experience interests are updated/);
});

test("retired Learning Journal UI and endpoint are absent; XP logic remains", () => {
  for (const path of [
    "../src/components/gamification/JournalStamps.jsx",
    "../src/components/gamification/journalStamps.module.css",
    "../src/app/api/gamification/reflect/route.js",
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), false, path);
  for (const path of [
    "../src/app/dashboard/page.js",
    "../src/app/journey/page.js",
    "../src/app/profile/page.js",
    "../src/components/gamification/SkillQuestHub.jsx",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /My Learning Journal|Workshop Reflections|<JournalStamps|section="journal"/i, path);
  }
  const service = readFileSync(new URL("../src/services/skillQuestEngagement.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(service, /getReflectionStats|validateReflection|REFLECTION_MOODS|LEARNING_MOMENTS/);
  assert.match(readFileSync(new URL("../src/services/gamificationAdmin.js", import.meta.url), "utf8"), /creditXp\(student, xpReward\)/);
});
