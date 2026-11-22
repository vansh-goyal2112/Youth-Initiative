import test from "node:test";
import assert from "node:assert/strict";
import { validateBadgeDefinition, countMatchingSessions, findUnmetBadgeIds, mergeBadgeDefinitions } from "../src/services/customBadges.mjs";
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
  assert.deepEqual(findUnmetBadgeIds(definitions, records), ["custom:robotics"]);
});
test("incomplete historical snapshots do not trigger unsafe custom badge removal", () => {
  const definitions = [
    { badgeId: "custom:topic", status: "active", rule: { type: "sessions_topic", matchValue: "robotics", minCount: 3 } },
    { badgeId: "custom:count", status: "active", rule: { type: "sessions_any", minCount: 2 } },
  ];
  const records = [{ status: "completed", workshopSnapshot: null }];
  assert.deepEqual(findUnmetBadgeIds(definitions, records), ["custom:count"]);
});

test("built-in badge overrides retain their identity and an archive replaces the active default", () => {
  const builtIns = mergeBadgeDefinitions([]);
  assert.deepEqual(builtIns.map(badge => badge.badgeId), [
    "first-step", "tech-explorer", "skill-builder", "curious-learner", "workshop-champion",
  ]);
  const original = builtIns[0];
  const [archived, ...others] = mergeBadgeDefinitions([
    { ...original, name: "First Workshop", status: "archived" },
    { id: "badge-def:custom", badgeId: "custom:one", status: "active" },
  ]);
  assert.equal(archived.badgeId, original.badgeId);
  assert.equal(archived.name, "First Workshop");
  assert.equal(archived.status, "archived");
  assert.equal(others.length, 5);
  assert.ok(!findUnmetBadgeIds([archived], []).includes(original.badgeId));
});

test("category-based defaults count completed sessions and distinct skill areas", () => {
  const [, tech, , curious] = mergeBadgeDefinitions([]);
  const records = ["Technology", "Technology", "Health", "Trades"].map(category =>
    ({ status: "completed", workshopSnapshot: { category } })
  );
  records.push({ status: "reversed", workshopSnapshot: { category: "Arts" } });
  assert.equal(countMatchingSessions(tech.rule, records), 2);
  assert.equal(countMatchingSessions(curious.rule, records), 3);
  assert.deepEqual(validateBadgeDefinition(tech).rule, tech.rule);
  assert.deepEqual(validateBadgeDefinition(curious).rule, curious.rule);
});

test("reversing an unrelated completion preserves a built-in badge earned under an earlier rule", () => {
  const [original] = mergeBadgeDefinitions([]);
  const [edited] = mergeBadgeDefinitions([
    { ...original, updatedAt: "2026-11-21", rule: { ...original.rule, minCount: 2 } },
  ]);
  const reversed = { status: "completed" };
  assert.deepEqual(findUnmetBadgeIds([edited], [], reversed), []);
  assert.deepEqual(findUnmetBadgeIds([edited], [{ status: "completed" }], reversed), ["first-step"]);
});
