import test from "node:test";
import assert from "node:assert/strict";
import { presentAdminAudit } from "../src/services/adminAuditPresentation.mjs";

test("audit labels use staff names and actual outcomes without exposing internal IDs", () => {
  const staff = [
    { id: "internal-a", firstName: "Taylor", lastName: "Chen" },
    { id: "internal-b", email: "alex@sait.ca" },
  ];
  const output = presentAdminAudit([
    { id: "saved", actorUid: "internal-a", action: "badge.create", outcome: "success", subject: "Digital Youth Explorer", attemptId: "attempt" },
    { id: "attempt", actorUid: "internal-a", action: "badge.create", outcome: "attempted" },
    { id: "failed", actorUid: "internal-b", action: "badge.archive", outcome: "failed" },
    { id: "legacy", actorUid: "unknown", action: "badges.manage", resource: "/api/admin/badges", outcome: "attempted" },
    { id: "previous-success", actorUid: "internal-a", action: "admins.promote_super_admin", outcome: "completed" },
  ], staff, 10);
  assert.deepEqual(output.map(({ staffName, actionLabel, outcome }) => [staffName, actionLabel, outcome]), [
    ["Taylor Chen", "Created badge: Digital Youth Explorer", "success"],
    ["alex@sait.ca", "Archive badge", "failed"],
    ["Unknown staff member", "Manage badges", "attempted"],
    ["Taylor Chen", "Granted Super Admin access", "success"],
  ]);
  assert.ok(output.every(entry => !("actorUid" in entry) && !("resource" in entry)));
});

test("an unpaired attempt does not imply success", () => {
  const [entry] = presentAdminAudit([
    { id: "pending", actorUid: "staff", action: "badge.update", outcome: "attempted" },
  ], [{ id: "staff", displayName: "Alex Morgan" }], 1);
  assert.equal(entry.staffName, "Alex Morgan");
  assert.equal(entry.actionLabel, "Update badge");
  assert.equal(entry.outcome, "attempted");
});

test("confirmed mutations expose safe change details and partial results stay reviewable", () => {
  const output = presentAdminAudit([
    { id: "updated", action: "workshops.edit", outcome: "success", subject: "Intro to Robotics",
      details: ["XP reward changed from 100 to 175"] },
    { id: "xp", action: "xp.grant", outcome: "review" },
    { id: "repeat", action: "xp.redeem", outcome: "unchanged" },
  ], [], 10);
  assert.equal(output[0].actionLabel, "Updated workshop: Intro to Robotics");
  assert.deepEqual(output[0].details, ["XP reward changed from 100 to 175"]);
  assert.deepEqual(output.slice(1).map(({ outcome }) => outcome), ["review", "unchanged"]);
});
