// Central authorization policy for SAIT Youth Initiative administrators.
// Never use client-supplied role or permission data for authorization.
// Permission overrides can only be applied by a separately authorized super admin.

export const ADMIN_PERMISSIONS = Object.freeze([
  "students.view",
  "students.edit",
  "students.deactivate",
  "students.delete",
  "reports.generate",
  "reports.export",
  "workshops.view",
  "workshops.create",
  "workshops.edit",
  "workshops.delete",
  "workshops.import",
  "attendance.view",
  "attendance.manage",
  "admins.view",
  "admins.approve",
  "admins.manage",
  "audit.view",
]);

export const ADMIN_ROLES = Object.freeze({
  super_admin: Object.freeze([...ADMIN_PERMISSIONS]),
  program_admin: Object.freeze([
    "students.view", "students.edit", "students.deactivate",
    "reports.generate", "reports.export",
    "workshops.view", "workshops.create", "workshops.edit",
    "workshops.import", "attendance.view", "attendance.manage",
  ]),
  workshop_coordinator: Object.freeze([
    "workshops.view", "workshops.create", "workshops.edit",
    "workshops.import", "attendance.view", "attendance.manage",
  ]),
  viewer: Object.freeze([
    "students.view", "workshops.view", "attendance.view",
  ]),
});

const KNOWN_PERMISSIONS = new Set(ADMIN_PERMISSIONS);
const PRIVILEGED_PERMISSIONS = new Set([
  "admins.view", "admins.approve", "admins.manage",
  "audit.view", "students.delete",
]);

export function isSaitEmail(value) {
  return typeof value === "string" &&
    /^[^@\s]+@sait\.ca$/i.test(value.trim());
}

export function resolveAdminPermissions(admin) {
  if (!admin || admin.status !== "active") return [];
  const role = admin.adminRole;
  if (!Object.hasOwn(ADMIN_ROLES, role)) return [];
  if (role === "super_admin") return [...ADMIN_ROLES.super_admin];
  const granted = new Set(ADMIN_ROLES[role]);
  const overrides = admin.permissionOverrides;
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    for (const [name, value] of Object.entries(overrides)) {
      if (!KNOWN_PERMISSIONS.has(name) || typeof value !== "boolean") continue;
      // Super Admin powers are never delegated via per-user overrides.
      if (PRIVILEGED_PERMISSIONS.has(name)) continue;
      if (value) granted.add(name);
      else granted.delete(name);
    }
  }
  return [...granted];
}

export function hasAdminPermission(admin, permission) {
  return KNOWN_PERMISSIONS.has(permission) &&
    resolveAdminPermissions(admin).includes(permission);
}

// Validate the exact payload the Super Admin may assign to another person.
export function validatePermissionOverrides(overrides) {
  if (!overrides || typeof overrides !== "object" ||
      Array.isArray(overrides)) return false;
  return Object.entries(overrides).every(([name, value]) =>
    KNOWN_PERMISSIONS.has(name) &&
    !PRIVILEGED_PERMISSIONS.has(name) &&
    typeof value === "boolean"
  );
}
