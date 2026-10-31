import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_PERMISSIONS, isSaitEmail, resolveAdminPermissions,
  hasAdminPermission, validatePermissionOverrides,
} from "../src/services/adminPermissions.js";

test("SAIT email validation rejects lookalike domains", () => {
  assert.equal(isSaitEmail("Abdullah.Rafih@sait.ca"), true);
  for (const email of ["a@sait.ca.evil.com", "a@xsait.ca", "a@sait.ca@evil.com", "", null]) {
    assert.equal(isSaitEmail(email), false);
  }
});

test("inactive and unknown roles get no permissions", () => {
  assert.deepEqual(resolveAdminPermissions({ adminRole: "super_admin", status: "inactive" }), []);
  assert.deepEqual(resolveAdminPermissions({ adminRole: "admin", status: "active" }), []);
  assert.deepEqual(resolveAdminPermissions({ adminRole: "hacker", status: "active" }), []);
});

test("super admin retains full access and cannot be overridden", () => {
  const admin = { adminRole: "super_admin", status: "active", permissionOverrides: { "reports.generate": false } };
  assert.deepEqual(resolveAdminPermissions(admin), ADMIN_PERMISSIONS);
});

test("role defaults can be narrowed or expanded per administrator", () => {
  const admin = {
    adminRole: "program_admin", status: "active",
    permissionOverrides: { "reports.generate": false, "workshops.delete": true },
  };
  assert.equal(hasAdminPermission(admin, "reports.generate"), false);
  assert.equal(hasAdminPermission(admin, "workshops.delete"), true);
  assert.equal(hasAdminPermission(admin, "admins.manage"), false);
});

test("privileged and unknown permissions cannot be delegated", () => {
  const admin = {
    adminRole: "viewer", status: "active",
    permissionOverrides: { "admins.manage": true, "students.delete": true, "unexpected.power": true },
  };
  assert.equal(hasAdminPermission(admin, "admins.manage"), false);
  assert.equal(hasAdminPermission(admin, "students.delete"), false);
  assert.equal(hasAdminPermission(admin, "unexpected.power"), false);
  assert.equal(validatePermissionOverrides({ "reports.generate": false }), true);
  assert.equal(validatePermissionOverrides({ "admins.manage": true }), false);
  assert.equal(validatePermissionOverrides({ "reports.generate": "false" }), false);
});
