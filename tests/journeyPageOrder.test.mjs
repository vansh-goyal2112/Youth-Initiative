import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Journey section order matches requested priority exactly", () => {
  const page = read("../src/app/journey/page.js");
  const anchors = [
    'className="journey-game-hero"',
    'id="journey-recommended-heading"',
    'id="journey-pathways-heading"',
    'id="journey-upcoming-heading"',
    '<AdventureTrail quests={gameData.quests || []}',
    'id="journey-badges-heading"',
  ];
  const indices = anchors.map(anchor => page.indexOf(anchor));
  assert.ok(indices.every(x => x >= 0), "every required section must exist");
  assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
  assert.match(page, /<h2 id="journey-recommended-heading">Recommended experiences<\/h2>/);
  assert.match(page, /<h2 id="journey-pathways-heading">Future pathways \(SAIT programs\)<\/h2>/);
  assert.match(page, /<h2 id="journey-upcoming-heading">Upcoming at SAIT<\/h2>/);
  assert.match(page, /<h2 id="journey-badges-heading">See my badges<\/h2>/);
  assert.match(page, /<Link href="\/badges">See my badges/);
});

test("Upcoming at SAIT hides entire section when no future session is scheduled", () => {
  const page = read("../src/app/journey/page.js");
  assert.match(page, /\{upcomingSessions\.length > 0 && \(/);
  assert.match(page, /upcomingSessions\.map\(workshop =>/);
  assert.match(page, /formatWorkshopDate\(workshop\.startDate\)/);
  assert.match(page, /workshopDateLabel\(workshop\.daysAway\)/);
  assert.match(page, /registeredWorkshopIds\.has\(workshop\.id\)/);
});

test("Recommendations reuse student interests/history/grade rules and do not block Journey progress", () => {
  const page = read("../src/app/journey/page.js");
  assert.match(page, /recommendYouthWorkshops\(\{ workshops, registrations, student \}\)/);
  assert.match(page, /Promise\.allSettled\(\[/);
  assert.match(page, /const progressRequest = studentFetch\("\/api\/gamification"\)/);
  assert.match(page, /studentFetch\("\/api\/gamification\/reconcile"/);
  assert.match(page, /<WorkshopArtwork workshop=\{workshop\}/);
  assert.match(page, /setPathways\(pathwayData\.recommendations\)/);
  assert.match(page, /setWorkshops\(workshopData\.workshops\)/);
  assert.match(page, /setRegistrations\(registrationData\.registrations\)/);
  assert.match(page, /<AdventureTrail quests=\{gameData\.quests \|\| \[\]\} totalXp=\{gameData\.totalXp\} showBadgeLink=\{false\} \/>/);
  const adventure = read("../src/components/gamification/AdventureTrail.jsx");
  assert.match(adventure, /showBadgeLink = true/);
  assert.match(adventure, /\{showBadgeLink && <Link href="\/badges">/);
});

test("Unrequested statistics and skill-area UI are not between the specified sections", () => {
  const page = read("../src/app/journey/page.js");
  assert.doesNotMatch(page, /Workshops by Area|skill-track-section|journey-game-stats|SkillTrackCard/);
  // Underlying data remains available to the badges engine; no API changes.
  const gamification = read("../src/app/api/gamification/route.js");
  assert.match(gamification, /skillTracks,/);
  assert.match(gamification, /quests,/);
  assert.match(gamification, /badgeCount:/);
});
