import test from "node:test";
import assert from "node:assert/strict";
import { validateBadgeDefinition, countMatchingSessions } from "../src/services/customBadges.mjs";
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
