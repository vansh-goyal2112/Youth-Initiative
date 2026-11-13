import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { recordAdminAudit } from "@/services/adminAudit";
import {
  readCosmosDocument, replaceCosmosDocument, deleteCosmosDocument,
  cosmosNow, isCosmosPreconditionFailed,
} from "@/services/cosmosData";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const actor = await requireAdminPermission(request, "badges.manage");
    const body = await request.json().catch(() => null);
    const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
    const badgeId = typeof body?.badgeId === "string" ? body.badgeId.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!studentId || studentId.length > 128 || !badgeId || badgeId.length > 150 || reason.length < 5 || reason.length > 250) {
      return Response.json({ message: "Student, badge and removal reason (5–250 characters) are required." }, { status: 400 });
    }
    const student = await readCosmosDocument("students", studentId);
    if (!student) return Response.json({ message: "Student not found." }, { status: 404 });
    const badges = Array.isArray(student.badges) ? student.badges : [];
    if (!badges.includes(badgeId)) return Response.json({ message: "This student does not currently hold that badge." }, { status: 409 });
    const suppressed = Array.isArray(student.suppressedBadgeIds) ? student.suppressedBadgeIds : [];
    try {
      await replaceCosmosDocument("students", student, {
        badges: badges.filter(item => item !== badgeId),
        badgeCount: badges.length - 1,
        suppressedBadgeIds: [...new Set([...suppressed, badgeId])],
        updatedAt: cosmosNow(),
      });
    } catch (error) {
      if (isCosmosPreconditionFailed(error)) return Response.json({ message: "Student badges changed. Refresh and try again." }, { status: 409 });
      throw error;
    }
    try {
      await deleteCosmosDocument("studentBadges", studentId + "_" + badgeId);
      await recordAdminAudit({
        actorUid: actor.uid, action: "badge.revoke", resource: "student:" + studentId + ":badge:" + badgeId, outcome: "success",
      });
    } catch (error) {
      console.error("Badge removed but auxiliary records require reconciliation:", studentId, badgeId, error?.message);
      return Response.json({ success: true, reviewPending: true,
        message: "Badge removed from the student's profile; audit/history requires review." }, { status: 202 });
    }
    return Response.json({ success: true, message: "Badge removed and suppression recorded. It will not be re-awarded automatically." });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Badge could not be removed." }, { status: 500 });
  }
}
