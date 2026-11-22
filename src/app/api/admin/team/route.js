import { describeAdminAudit, withAdminAudit } from "@/services/adminAudit";
import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { auditFieldChanges } from "@/services/adminAuditChanges.mjs";
import { ADMIN_ROLES, validatePermissionOverrides } from "@/services/adminPermissions";
import { queryCosmosDocuments, readCosmosDocument, replaceCosmosDocument, cosmosNow } from "@/services/cosmosData";
import { adminAuth } from "@/services/firebaseAdmin";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    await requireAdminPermission(request, "admins.view");
    const records = await queryCosmosDocuments("admins",
      "SELECT c.id, c.email, c.status, c.adminRole, c.permissionOverrides, c.requestedAt, c.updatedAt, c.createdAt FROM c WHERE c.role = 'admin'");
    return Response.json({ success: true, admins: records }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminAccessResponse(error) || Response.json({ message: "Unable to load staff." }, { status: 500 });
  }
}

// Approval, rejection, role assignment, and one-person overrides.
// The requestor's identity, role, and permissions are never accepted from a client payload.
async function updateStaff(request) {
  try {
    const acting = await requireAdminPermission(request, "admins.manage");
    if (acting.adminData.adminRole !== "super_admin") {
      return Response.json({ message: "Super Admin required." }, { status: 403 });
    }
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status = body.status;
    const adminRole = body.adminRole;
    const overrides = body.permissionOverrides ?? {};
    if (!id || !["active", "pending", "rejected", "inactive"].includes(status) ||
        !Object.hasOwn(ADMIN_ROLES, adminRole) ||
        !validatePermissionOverrides(overrides)) {
      return Response.json({ message: "Invalid administrator change." }, { status: 400 });
    }
    if (id === acting.uid) {
      return Response.json({ message: "You cannot change your own administrator privileges." }, { status: 403 });
    }
    if (adminRole === "super_admin") {
      return Response.json({ message: "Super Admin designation requires separate secure provisioning." }, { status: 403 });
    }
    const target = await readCosmosDocument("admins", id);
    if (!target || target.role !== "admin" || target.adminRole === "super_admin") {
      return Response.json({ message: "Administrator not found or protected." }, { status: 404 });
    }
    const user = await adminAuth.getUser(id);
    if (user.disabled || !user.emailVerified ||
        user.email?.trim().toLowerCase() !== target.email?.trim().toLowerCase()) {
      return Response.json({ message: "Target must have a verified active Firebase account." }, { status: 409 });
    }
    const roleLabel = role => role?.replaceAll("_", " ");
    const details = auditFieldChanges(
      { ...target, adminRole: roleLabel(target.adminRole) },
      { status, adminRole: roleLabel(adminRole) },
      [["status", "Staff access status", true], ["adminRole", "Staff role", true]],
    );
    const oldOverrides = target.permissionOverrides || {};
    if ([...new Set([...Object.keys(oldOverrides), ...Object.keys(overrides)])]
      .some(permission => oldOverrides[permission] !== overrides[permission])) {
      details.push("Individual permissions changed");
    }
    describeAdminAudit(request, {
      subject: [target.firstName, target.lastName].filter(Boolean).join(" ") || user.displayName || target.email,
      details, ...(!details.length ? { outcome: "unchanged" } : {}),
    });
    const updated = await replaceCosmosDocument("admins", target, {
      status, adminRole, permissionOverrides: overrides,
      updatedAt: cosmosNow(), updatedBy: acting.uid,
    });
    return Response.json({ success: true, id: updated.id, message: "Administrator access updated." });
  } catch (error) {
    const access = adminAccessResponse(error);
    if (access) return access;
    if (error?.code === "auth/user-not-found") {
      return Response.json({ message: "Associated identity not found." }, { status: 404 });
    }
    console.error("Admin permissions update failed:", error?.message);
    return Response.json({ message: "Unable to update administrator access." }, { status: 500 });
  }
}

export const PATCH = withAdminAudit(updateStaff);
