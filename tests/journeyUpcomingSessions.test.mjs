import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findJourneyUpcomingSessions } from "../src/utils/journeyUpcomingSessions.mjs";
const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
const today = new Date(2026, 10, 21, 12, 0);
const workshop = (id, date, more = {}) => ({
  id, title: id, status: "active", startDate: date, ...more,
});

test("Journey upcoming lists active future workshops soonest first, beyond seven days", () => {
  const result = findJourneyUpcomingSessions([
    workshop("far", "2027-01-05"),
    workshop("tomorrow", "2026-11-22"),
    workshop("today", "2026-11-21"),
    workshop("past", "2026-11-20"),
    workshop("next-week", "2026-12-01"),
  ], { today });
  assert.deepEqual(result.map(w => w.id), ["today", "tomorrow", "next-week", "far"]);
  assert.deepEqual(result.map(w => w.daysAway).slice(0, 2), [0, 1]);
});

test("Journey chooses next active session rather than outdated parent date or archived sessions", () => {
  const result = findJourneyUpcomingSessions([
    workshop("multi", "2025-01-01", { sessions: [
      { id: "archived", startDate: "2026-11-22", status: "archived" },
      { id: "past", startDate: "2026-11-19", status: "active" },
      { id: "later", startDate: "2026-12-07", status: "active" },
      { id: "next", startDate: "2026-11-23", status: "active" },
    ] }),
    workshop("missing", "2026-11-22", { sessions: [
      { id: "past", startDate: "2026-11-01", status: "archived" },
    ] }),
  ], { today });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "multi");
  assert.equal(result[0].sessionId, "next");
  assert.equal(result[0].startDate, "2026-11-23");
});

test("Journey suppresses closed, inactive, archived, undated and expired programs", () => {
  const result = findJourneyUpcomingSessions([
    workshop("closed", "2026-11-22", { availabilityStatus: "closed" }),
    workshop("inactive", "2026-11-22", { status: "inactive" }),
    workshop("expired", "2026-11-20"),
    workshop("undated", null),
    workshop("archived-only", "2026-11-23", { sessions: [
      { id: "closed-session", startDate: "2026-11-23", status: "archived" },
    ] }),
  ], { today });
  assert.deepEqual(result, []);
  assert.deepEqual(findJourneyUpcomingSessions([], { today }), []);
});

test("Journey upcoming is per-workshop, stable, limit applied after chronological sort", () => {
  const result = findJourneyUpcomingSessions([
    workshop("c", "2026-11-23"),
    workshop("b", "2026-11-22"),
    workshop("a", "2026-11-22"),
    workshop("d", "2026-11-25"),
  ], { today, limit: 2 });
  assert.deepEqual(result.map(w => w.id), ["a", "b"]);
  assert.deepEqual(findJourneyUpcomingSessions(null, { today }), []);
  assert.deepEqual(findJourneyUpcomingSessions([], { today, limit: 0 }), []);
});

test("Journey uses grade-filtered workshop API; Home upcoming selection stays unchanged", () => {
  const page = source("../src/app/journey/page.js");
  const workshopApi = source("../src/app/api/workshops/route.js");
  const home = source("../src/app/dashboard/page.js");
  assert.match(page, /studentFetch\("\/api\/workshops"/);
  assert.match(page, /studentFetch\("\/api\/registrations"/);
  assert.match(page, /recommendYouthWorkshops\(\{ workshops, registrations, student \}\)/);
  assert.match(page, /findJourneyUpcomingSessions\(workshops\)/);
  assert.match(workshopApi, /matchesStudentGrade\(workshop, student\.schoolGrade\)/);
  assert.match(home, /<UpcomingAdventures workshops=\{workshops\} registrations=\{registrations\}/);
});
