import { describeAdminAudit, withAdminAudit } from "@/services/adminAudit";
import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import {
  readCosmosDocument, createCosmosDocument, replaceCosmosDocument,
  cosmosNow, isCosmosPreconditionFailed, isCosmosConflict,
} from "@/services/cosmosData";
import { creditXp, getXpBalances, reverseEarnedXp } from "@/services/xpBalance.mjs";
import { calculateLevel, getLevelName } from "@/services/levelProgress.mjs";

export const runtime = "nodejs";

// Manual grants and corrections update the balances used by student pages.
// Event swag redemption uses /api/admin/rewards instead and never changes lifetime XP.
async function adjustXp(request) {
  try {
    const actor = await requireAdminPermission(request, "xp.adjust");
    const body = await request.json().catch(() => null);
    const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
    const amount = body?.amount;
    const action = body?.action === undefined ? "remove" : body.action;
    const grant = action === "grant";
    const adjustment = grant ? "grant" : "correction";
    const applyAdjustment = grant ? creditXp : reverseEarnedXp;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const operationId = typeof body?.operationId === "string" ? body.operationId.trim() : "";
    if (!["grant", "remove"].includes(action) || !studentId || studentId.length > 128 || !Number.isSafeInteger(amount) || amount <= 0 ||
        amount > 1000000 || reason.length < 5 || reason.length > 250 ||
        !/^[0-9a-f-]{36}$/i.test(operationId)) {
      return Response.json({ message: "Student, positive whole-number XP, reason (5–250 characters) and operation ID are required." }, { status: 400 });
    }
    const id = "xp-adjust:" + studentId + ":" + operationId;
    const student = await readCosmosDocument("students", studentId);
    if (!student || (student.role && student.role !== "student")) {
      return Response.json({ message: "Student not found." }, { status: 404 });
    }
    describeAdminAudit(request, {
      action: grant ? "xp.grant" : "xp.adjust",
      subject: student.youthId ? "Youth ID " + student.youthId : "Student account",
      details: [grant ? "XP granted: " + amount : "Earned XP correction: " + amount],
    });
    const points = grant ? amount : -amount;
    const prior = await readCosmosDocument("xpTransactions", id);
    if (prior) {
      if (prior.points !== points || prior.note !== reason) {
        return Response.json({ message: "This operation ID was used for a different adjustment." }, { status: 409 });
      }
      if (prior.status !== "completed") {
        return Response.json({ message: `This XP ${adjustment} is already recorded. Check the ledger before retrying.` }, { status: 409 });
      }
      describeAdminAudit(request, { outcome: "unchanged", details: ["This XP adjustment was already recorded"] });
      const latest = await readCosmosDocument("students", studentId);
      if (!latest) return Response.json({ message: "Student not found." }, { status: 404 });
      const balances = getXpBalances(latest);
      return Response.json({
        success: true, alreadyProcessed: true, ...balances, level: calculateLevel(balances.totalXp),
        message: `This XP ${adjustment} was already recorded.`,
      });
    }
    try { applyAdjustment(student, amount); }
    catch (error) { return Response.json({ message: error.message }, { status: 409 }); }
    const stamp = cosmosNow();
    let transaction;
    try {
      transaction = await createCosmosDocument("xpTransactions", {
        id, studentId, action: "admin_xp_adjustment", points,
        actorUid: actor.uid, actorEmail: actor.email || actor.adminData?.email || "",
        note: reason, status: "processing", createdAt: stamp, updatedAt: stamp,
      });
    } catch (error) {
      if (isCosmosConflict(error)) return Response.json({ message: `This XP ${adjustment} already exists.` }, { status: 409 });
      throw error;
    }

    let updated;
    for (let attempt = 0; attempt < 3; attempt++) {
      const fresh = await readCosmosDocument("students", studentId);
      if (!fresh || (fresh.role && fresh.role !== "student")) break;
      let balances;
      try { balances = applyAdjustment(fresh, amount); }
      catch (error) {
        if (error instanceof RangeError) break;
        throw error;
      }
      const level = calculateLevel(balances.totalXp);
      try {
        updated = await replaceCosmosDocument("students", fresh, {
          ...balances, level, levelName: getLevelName(level), updatedAt: cosmosNow(),
        });
        break;
      } catch (error) {
        // An uncertain write stays processing so a retry cannot credit XP twice.
        if (!isCosmosPreconditionFailed(error)) throw error;
      }
    }
    if (!updated) {
      await replaceCosmosDocument("xpTransactions", transaction, {
        status: "rejected", updatedAt: cosmosNow(),
      });
      return Response.json({ message: `XP ${adjustment} was not applied. Refresh the student's balance.` }, { status: 409 });
    }
    const balances = { ...getXpBalances(updated), level: updated.level };
    try {
      await replaceCosmosDocument("xpTransactions", transaction, {
        status: "completed", completedAt: cosmosNow(), updatedAt: cosmosNow(),
      });
    } catch (error) {
      console.error("XP adjusted but ledger/audit needs reconciliation:", id, error?.message);
      return Response.json({
        success: true, reviewPending: true, ...balances,
        message: "XP was updated, but audit history needs review. Do not repeat the request.",
      }, { status: 202 });
    }
    return Response.json({
      success: true, ...balances,
      message: grant
        ? "XP granted and logged."
        : "XP corrected and logged. Any outstanding correction will be offset by future earnings.",
    });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "XP adjustment could not be confirmed. Inspect the ledger before retrying." }, { status: 500 });
  }
}

export const POST = withAdminAudit(adjustXp);
