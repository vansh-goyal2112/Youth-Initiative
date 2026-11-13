import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import {
  readCosmosDocument, createCosmosDocument, replaceCosmosDocument,
  cosmosNow, isCosmosPreconditionFailed, isCosmosConflict,
} from "@/services/cosmosData";
import { reverseEarnedXp } from "@/services/xpBalance.mjs";
import { calculateLevel, getLevelName } from "@/services/gamificationAdmin";
import { recordAdminAudit } from "@/services/adminAudit";

export const runtime = "nodejs";

// Correction of erroneously earned XP changes lifetime XP and current XP.
// Event swag redemption uses /api/admin/rewards instead and never changes lifetime XP.
export async function POST(request) {
  try {
    const actor = await requireAdminPermission(request, "xp.adjust");
    const body = await request.json().catch(() => null);
    const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
    const amount = body?.amount;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const operationId = typeof body?.operationId === "string" ? body.operationId.trim() : "";
    if (!studentId || studentId.length > 128 || !Number.isSafeInteger(amount) || amount <= 0 ||
        amount > 1000000 || reason.length < 5 || reason.length > 250 ||
        !/^[0-9a-f-]{36}$/i.test(operationId)) {
      return Response.json({ message: "Student, positive whole-number XP, reason (5–250 characters) and operation ID are required." }, { status: 400 });
    }
    const id = "xp-adjust:" + studentId + ":" + operationId;
    const prior = await readCosmosDocument("xpTransactions", id);
    if (prior) {
      return Response.json({
        success: prior.status === "completed", alreadyProcessed: true,
        message: prior.status === "completed"
          ? "This XP correction was already recorded."
          : "This XP correction is already in progress or requires review. Do not repeat it.",
      }, { status: prior.status === "completed" ? 200 : 409 });
    }
    const student = await readCosmosDocument("students", studentId);
    if (!student || (student.role && student.role !== "student")) {
      return Response.json({ message: "Student not found." }, { status: 404 });
    }
    try { reverseEarnedXp(student, amount); }
    catch (error) { return Response.json({ message: error.message }, { status: 409 }); }
    const stamp = cosmosNow();
    let transaction;
    try {
      transaction = await createCosmosDocument("xpTransactions", {
        id, studentId, action: "admin_xp_adjustment", points: -amount,
        actorUid: actor.uid, actorEmail: actor.email || actor.adminData?.email || "",
        note: reason, status: "processing", createdAt: stamp, updatedAt: stamp,
      });
    } catch (error) {
      if (isCosmosConflict(error)) return Response.json({ message: "This XP correction already exists." }, { status: 409 });
      throw error;
    }

    let updated;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const fresh = await readCosmosDocument("students", studentId);
        if (!fresh) throw new Error("Student not found.");
        const balances = reverseEarnedXp(fresh, amount);
        try {
          updated = await replaceCosmosDocument("students", fresh, {
            ...balances, level: calculateLevel(balances.totalXp),
            levelName: getLevelName(calculateLevel(balances.totalXp)),
            updatedAt: cosmosNow(),
          });
          break;
        } catch (error) {
          if (!isCosmosPreconditionFailed(error)) throw error;
        }
      }
      if (!updated) throw new Error("Student balance changed concurrently.");
    } catch (error) {
      try {
        await replaceCosmosDocument("xpTransactions", transaction, {
          status: "rejected", updatedAt: cosmosNow(),
        });
      } catch (rollbackError) { console.error("XP adjustment rejection needs review:", id, rollbackError?.message); }
      return Response.json({ message: "XP correction was not applied. Refresh the student's balance." }, { status: 409 });
    }
    try {
      await replaceCosmosDocument("xpTransactions", transaction, {
        status: "completed", completedAt: cosmosNow(), updatedAt: cosmosNow(),
      });
      await recordAdminAudit({
        actorUid: actor.uid, action: "xp.adjust", resource: "student:" + studentId, outcome: "success",
      });
    } catch (error) {
      console.error("XP adjusted but ledger/audit needs reconciliation:", id, error?.message);
      return Response.json({ success: true, reviewPending: true, ...{
        totalXp: updated.totalXp, currentXp: updated.currentXp, xpCorrectionDebt: updated.xpCorrectionDebt,
      }, message: "XP was corrected, but audit history needs review. Do not repeat the request." }, { status: 202 });
    }
    return Response.json({
      success: true,
      totalXp: updated.totalXp, currentXp: updated.currentXp,
      xpCorrectionDebt: updated.xpCorrectionDebt,
      message: "XP corrected and logged. Any outstanding correction will be offset by future earnings.",
    });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "XP correction could not be completed. Inspect the ledger before retrying." }, { status: 500 });
  }
}
