import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  groupWorkshopsByAvailability,
  isRegistrationClosed,
} from "../src/utils/workshopAvailability.mjs";
import { awardForCompletion } from "../src/services/completionRules.mjs";

const source = file => readFileSync(new URL(file, import.meta.url), "utf8");

test("only explicitly closed registrations move to the bottom", () => {
  const records = [
    { id: "a", availabilityStatus: "closed", xpReward: 175 },
    { id: "b", availabilityStatus: "unknown", xpReward: 100 },
    { id: "c", availabilityStatus: "open", xpReward: 200 },
    { id: "d", xpReward: 75 },
    { id: "e", availabilityStatus: "closed", xpReward: 200 },
  ];
  const { currentWorkshops, closedWorkshops } = groupWorkshopsByAvailability(records);
  assert.deepEqual(currentWorkshops.map(w => w.id), ["b", "c", "d"]);
  assert.deepEqual(closedWorkshops.map(w => w.id), ["a", "e"]);
  assert.equal(isRegistrationClosed(records[0]), true);
  assert.equal(isRegistrationClosed(records[1]), false);
  assert.equal(isRegistrationClosed(null), false);
  assert.equal(records[0].xpReward, 175);
  assert.equal(records[4].xpReward, 200);
  assert.deepEqual(groupWorkshopsByAvailability([]), { currentWorkshops: [], closedWorkshops: [] });
  assert.equal(records[0].availabilityStatus, "closed");
});

test("closed programs retain full configured reward and eligible past claims earn half", () => {
  const closed = { id: "archived-robotics", availabilityStatus: "closed", xpReward: 175 };
  assert.equal(awardForCompletion(closed, "self_reported"), 87);
  assert.equal(awardForCompletion(closed, "qr"), 175);
  assert.equal(awardForCompletion({ ...closed, xpReward: 100 }, "self_reported"), 50);
  assert.equal(awardForCompletion({ ...closed, xpReward: 500 }, "self_reported"), 250);
});

test("Workshop catalogue keeps all matching programs, grouping closed after others", () => {
  const page = source("../src/app/workshops/page.js");
  assert.match(page, /groupWorkshopsByAvailability\(filteredWorkshops\)/);
  assert.ok(page.indexOf("currentWorkshops.map") < page.indexOf("closedWorkshops.map"));
  assert.match(page, /Registration closed \(\{closedWorkshops\.length\}\)/);
  assert.match(page, /Previously Completed, subject to staff review/);
  assert.doesNotMatch(page, /filter\(.*availabilityStatus\s*!==\s*"closed"/);
});

test("Closed cards show full configured reward as reference, half-XP past claim, and direct claim link", () => {
  const card = source("../src/components/workshops/WorkshopCard.js");
  assert.match(card, /registrationClosed && xpReward !== null/);
  assert.match(card, /awardForCompletion\(\{ xpReward \}, "self_reported"\)/);
  assert.match(card, /Workshop reward: <strong>\{xpReward\} XP/);
  assert.match(card, /Earn <strong>\{xpReward\} XP/);
  assert.match(card, /Claim \$\{pastAttendanceXp\} XP \(half reward\)/);
  assert.match(card, /completed-workshops\?workshop=/);
  assert.match(card, /<Link href=\{\`\/workshops\/\$\{workshop\.id\}\`\}/);
});

test("past attendance endpoint still includes closed-registration workshops and awards half XP", () => {
  const report = source("../src/app/api/workshops/self-report/route.js");
  assert.match(report, /WHERE NOT IS_DEFINED\(c\.status\) OR c\.status != 'deleted'/);
  assert.match(report, /\["active", "inactive"\]/);
  assert.match(report, /awardForCompletion\(workshop, "self_reported"\)/);
  assert.match(report, /pending_review/);
  assert.doesNotMatch(report, /availabilityStatus\s*!==\s*"closed"/);
});
