import test from "node:test";
import assert from "node:assert/strict";
import { getAdminGuide, getAdminTour } from "../src/components/admin/adminHelpContent.mjs";
import { ADMIN_ROLES } from "../src/services/adminPermissions.js";

const dashboardPaths = [
  "/admin",
  "/admin/redeem-xp",
  "/admin/attendance",
  "/admin/completions",
  "/admin/students",
  "/admin/workshops",
  "/admin/badges",
];

test("the program admin tour covers the dashboard and all six shortcuts", () => {
  const permissions = ADMIN_ROLES.program_admin;
  const titles = getAdminTour(dashboardPaths, "program_admin", permissions).map(step => step.title);
  assert.deepEqual(titles, [
    "Dashboard", "Redeem XP", "Attendance", "Review claims", "Student directory", "Workshop studio", "Badges",
  ]);
  assert.match(getAdminGuide("/admin/students", "program_admin", permissions).steps.at(-1).text, /Correct erroneous XP/);
});

test("event staff only receive the attendance and redemption guides", () => {
  const permissions = ADMIN_ROLES.event_staff;
  const tour = getAdminTour(dashboardPaths, "event_staff", permissions);
  assert.deepEqual(tour.map(step => step.title), ["Attendance", "Redeem XP"]);
  assert.match(tour[0].steps[0].text, /Ask the workshop coordinator/);
  assert.equal(getAdminGuide("/admin/students", "event_staff", permissions), null);
  assert.equal(getAdminGuide("/admin/security", "event_staff", permissions), null);
  assert.match(getAdminGuide("/admin/attendance", "event_staff", [...permissions, "attendance.manage"]).steps[0].text, /Generate check-in QR/);
});

test("help omits tasks that the viewer's permissions do not allow", () => {
  const permissions = ADMIN_ROLES.viewer;
  const guide = getAdminGuide("/admin/students", "viewer", permissions);
  assert.equal(guide.steps.length, 1);
  assert.match(guide.steps[0].text, /Search by name/);
  assert.equal(getAdminGuide("/admin/redeem-xp", "viewer", permissions), null);
});
