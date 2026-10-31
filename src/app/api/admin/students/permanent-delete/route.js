import {
  adminAccessResponse,
  requireAdminPermission,
} from "@/services/adminAccess";
import { adminAuth } from "@/services/firebaseAdmin";
import {
  cosmosNow,
  deleteCosmosDocument,
  queryCosmosDocuments,
  readCosmosDocument,
  replaceCosmosDocument,
} from "@/services/cosmosData";

export const runtime = "nodejs";

// Explicit feature gate: a customer-approved data-retention policy and a
// recovery/backup plan must exist before enabling irreversible deletion.
const PURGE_ENABLED = "ADMIN_PERMANENT_DELETE_ENABLED";
const DEPENDENT_CONTAINERS = ["registrations", "studentBadges", "xpTransactions"];

function reply(message, status, code) {
  return Response.json({ success: false, message, code }, { status });
}

async function authorize(request) {
  const admin = await requireAdminPermission(request, "students.delete");
  if (admin.adminData.adminRole !== "super_admin" ||
      !admin.mfaEnrolled || !admin.mfaVerified) {
    const error = new Error("Super Admin with verified MFA is required.");
    error.status = 403;
    throw error;
  }
  if (process.env[PURGE_ENABLED] !== "true") {
    const error = new Error("Permanent deletion is disabled until the approved data-retention and backup policy is configured.");
    error.status = 403;
    throw error;
  }
  return admin;
}

async function planRemoval(student) {
  const documents = {};
  for (const container of DEPENDENT_CONTAINERS) {
    documents[container] = await queryCosmosDocuments(
      container,
      "SELECT c.id FROM c WHERE c.studentId = @studentId",
      [{ name: "@studentId", value: student.id }]
    );
  }
  // Consent and activation information must not be orphaned either.
  const registration = student.registrationId
    ? await readCosmosDocument("pendingRegistrations", student.registrationId)
    : null;
  const youthReservation = student.youthId
    ? await readCosmosDocument("youthIdReservations", student.youthId.toLowerCase())
    : null;
  if (registration && registration.firebaseUid &&
      registration.firebaseUid !== student.id) {
    throw new Error("Consent registration does not match the student account.");
  }
  if (youthReservation && youthReservation.firebaseUid &&
      youthReservation.firebaseUid !== student.id) {
    throw new Error("Youth ID reservation does not match the student account.");
  }
  return { documents, registration, youthReservation };
}

async function input(request) {
  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id || id.length > 128) return { error: reply("Valid student ID is required.", 400) };
  const student = await readCosmosDocument("students", id);
  if (!student) return { error: reply("Student not found (it may already be deleted).", 404) };
  if (student.role !== "student" || (student.firebaseUid && student.firebaseUid !== id)) {
    return { error: reply("Protected or inconsistent student record.", 409) };
  }
  if (!["inactive", "deleting"].includes(student.accountStatus)) {
    return { error: reply("Deactivate the student before requesting permanent deletion.", 409) };
  }
  return { student, body };
}

export async function POST(request) {
  try {
    await authorize(request);
    const { student, error } = await input(request);
    if (error) return error;
    const plan = await planRemoval(student);
    return Response.json({
      success: true,
      dryRun: true,
      studentId: student.id,
      youthId: student.youthId,
      documents: Object.fromEntries(
        Object.entries(plan.documents).map(([key, value]) => [key, value.length])
      ),
      pendingRegistration: Number(Boolean(plan.registration)),
      youthIdReservation: Number(Boolean(plan.youthReservation)),
      firebaseAccount: "will be deleted if present",
      message: "Preview only. Nothing was deleted. Permanent deletion cannot be undone.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminAccessResponse(error) ||
      reply("Could not preview account deletion.", 500);
  }
}

export async function DELETE(request) {
  try {
    const admin = await authorize(request);
    const { student, body, error } = await input(request);
    if (error) return error;
    if (!student.youthId ||
      body.confirm !== `DELETE ${student.youthId}`) {
      return reply("Type DELETE followed by the exact Youth ID to confirm.", 400);
    }

    // Verify dependent records before modifying the account.
    await planRemoval(student);
    let authUserExists = false;
    try {
      const user = await adminAuth.getUser(student.id);
      authUserExists = true;
      if (!user.disabled) await adminAuth.updateUser(student.id, { disabled: true });
      await adminAuth.revokeRefreshTokens(student.id);
    } catch (authError) {
      if (authError?.code !== "auth/user-not-found") throw authError;
    }

    if (student.accountStatus !== "deleting") {
      await replaceCosmosDocument("students", student, {
        accountStatus: "deleting",
        deletionStartedAt: cosmosNow(),
        deletionRequestedBy: admin.uid,
      });
    }

    // Re-read on each retry. Deleting is non-atomic across Cosmos containers:
    // failures leave the account inaccessible and allow Super Admin to retry.
    const plan = await planRemoval(student);
    let deleted = 0;
    for (const [container, docs] of Object.entries(plan.documents)) {
      for (const doc of docs) {
        if (await deleteCosmosDocument(container, doc.id)) deleted++;
      }
    }
    if (plan.registration) {
      await deleteCosmosDocument("pendingRegistrations", plan.registration.id);
      deleted++;
    }
    if (plan.youthReservation) {
      await deleteCosmosDocument("youthIdReservations", plan.youthReservation.id);
      deleted++;
    }
    if (authUserExists) {
      try {
        await adminAuth.deleteUser(student.id);
      } catch (authError) {
        if (authError?.code !== "auth/user-not-found") throw authError;
      }
    }

    // Remove the student record LAST to keep failures recoverable by retry.
    await deleteCosmosDocument("students", student.id);
    return Response.json({
      success: true,
      removedRelatedRecords: deleted,
      message: "Student Firebase account, profile, and associated application data deleted. External backups and legally retained records are outside this operation.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const access = adminAccessResponse(error);
    if (access) return access;
    console.error("Student permanent deletion failed:", error?.message);
    return reply("Permanent deletion was not completed. The account remains blocked; a Super Admin must review and retry safely.", 500, "DELETE_INCOMPLETE");
  }
}
