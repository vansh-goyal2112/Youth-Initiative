import test from "node:test";
import assert from "node:assert/strict";
import { validateBadgeDefinition, countMatchingSessions, findUnmetCustomBadgeIds } from "../src/services/customBadges.mjs";
test("custom rules count multiple Robotics sessions independently", () => {
  const rule = { type: "sessions_topic", matchValue: "robotics", minCount: 3 };
  const registrations = [
    { status: "completed", sessionId: "one", workshopSnapshot: { title: "Robotics Lab" } },
    { status: "completed", sessionId: "two", workshopSnapshot: { title: "Robotics Lab" } },
    { status: "completed", sessionId: "three", workshopSnapshot: { title: "Robotics Lab" } },
    { status: "reversed", sessionId: "four", workshopSnapshot: { title: "Robotics Lab" } },
  ];
  assert.equal(countMatchingSessions(rule, registrations), 3);
});
test("badge rules are safe data and validate inputs", () => {
  const badge = validateBadgeDefinition({ name: "Robotics Explorer", rule: { type: "sessions_topic", minCount: 3, matchValue: "robotics" }, artworkUrl: "https://sait.ca/robotics.png" });
  assert.equal(badge.rule.minCount, 3);
  assert.throws(() => validateBadgeDefinition({ name: "x", rule: { type: "unsafe_code", minCount: 1 } }), /name/);
  assert.throws(() => validateBadgeDefinition({ name: "Robotics", rule: { type: "sessions_topic", minCount: 3, matchValue: "robotics" }, artworkUrl: "javascript:alert(1)" }), /HTTPS/);
});

test("reversing a Robotics session revokes only no-longer-earned active custom badges", () => {
  const records = [
    { status: "completed", workshopSnapshot: { title: "Robotics Lab" } },
    { status: "completed", workshopSnapshot: { title: "Robotics Lab" } },
    { status: "reversed", workshopSnapshot: { title: "Robotics Lab" } },
  ];
  const definitions = [
    { badgeId: "custom:robotics", status: "active", rule: { type: "sessions_topic", matchValue: "robotics", minCount: 3 } },
    { badgeId: "custom:starter", status: "active", rule: { type: "sessions_any", minCount: 1 } },
    { badgeId: "custom:historical", status: "archived", rule: { type: "sessions_any", minCount: 3 } },
  ];
  assert.deepEqual(findUnmetCustomBadgeIds(definitions, records), ["custom:robotics"]);
});
test("incomplete historical snapshots do not trigger unsafe custom badge removal", () => {
  const definitions = [
    { badgeId: "custom:topic", status: "active", rule: { type: "sessions_topic", matchValue: "robotics", minCount: 3 } },
    { badgeId: "custom:count", status: "active", rule: { type: "sessions_any", minCount: 2 } },
  ];
  const records = [{ status: "completed", workshopSnapshot: null }];
  assert.deepEqual(findUnmetCustomBadgeIds(definitions, records), ["custom:count"]);
});
