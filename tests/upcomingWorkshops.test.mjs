import test from "node:test";
import assert from "node:assert/strict";

import {
  daysUntilWorkshop,
  findUpcomingAdventures,
  workshopDateLabel,
} from "../src/utils/upcomingWorkshops.mjs";

const today = new Date(2026, 9, 16, 10, 0, 0);
const workshop = (id, startDate, status = "active") => ({
  id,
  title: id,
  startDate,
  status,
});

test("date-only values are compared by calendar day, not UTC midnight", () => {
  assert.equal(daysUntilWorkshop("2026-10-17", today), 1);
  assert.equal(daysUntilWorkshop("2026-10-16", today), 0);
  assert.equal(daysUntilWorkshop("2026-10-15", today), -1);
  assert.equal(daysUntilWorkshop("2026-10-17T19:00:00Z", today), 1);
});

test("invalid and unscheduled workshop dates are not treated as upcoming", () => {
  assert.equal(daysUntilWorkshop(null, today), null);
  assert.equal(daysUntilWorkshop("2026-02-30", today), null);
  assert.equal(daysUntilWorkshop("unknown", today), null);
  assert.equal(daysUntilWorkshop("2028-02-29", today), 501);
});

test("only unregistered active workshops in the next seven days appear", () => {
  const workshops = [
    workshop("future", "2026-10-24"),
    workshop("tomorrow", "2026-10-17"),
    workshop("today", "2026-10-16"),
    workshop("past", "2026-10-15"),
    workshop("inactive", "2026-10-18", "inactive"),
    workshop("registered", "2026-10-17"),
    workshop("unscheduled", null),
  ];
  const result = findUpcomingAdventures(
    workshops,
    [{ workshopId: "registered", status: "upcoming" }],
    { today }
  );
  assert.deepEqual(result.map((x) => x.id), ["today", "tomorrow"]);
});

test("upcoming list is limited, sorted and unaffected by unknown workshop status", () => {
  const workshops = [
    workshop("third", "2026-10-19"),
    workshop("first", "2026-10-17"),
    workshop("second", "2026-10-18"),
    workshop("fourth", "2026-10-20"),
  ];
  const result = findUpcomingAdventures(workshops, [], { today, limit: 2 });
  assert.deepEqual(result.map((x) => x.id), ["first", "second"]);
});

test("calendar reminder labels are human readable", () => {
  assert.equal(workshopDateLabel(0), "Today");
  assert.equal(workshopDateLabel(1), "Tomorrow");
  assert.equal(workshopDateLabel(4), "In 4 days");
});
