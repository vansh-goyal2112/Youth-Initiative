import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import {
  queryCosmosDocuments, readCosmosDocument, replaceCosmosDocument,
  deleteCosmosDocument, cosmosNow, isCosmosPreconditionFailed,
} from "@/services/cosmosData";
import { recordAdminAudit } from "@/services/adminAudit";
import { reverseEarnedXp } from "@/services/xpBalance.mjs";
import { completionTransactionId } from "@/services/completionRules.mjs";
import { calculateLevel, getLevelName } from "@/services/gamificationAdmin";

export const runtime = "nodejs";

const AUTO_BADGES = new Set([
  "first-step", "tech-explorer", "skill-builder", "curious-learner", "workshop-champion",
]);

function badgeEligibility(registrations) {
  const categories = new Set();
  let tech = false;
  for (const registration of registrations) {
    const category = registration.workshopSnapshot?.category || "General";
    categories.add(category);
    if (category === "Technology") tech = true;
  }
  const eligible = new Set();
  if (registrations.length >= 1) eligible.add("first-step");
  if (tech) eligible.add("tech-explorer");
  if (registrations.length >= 3) eligible.add("skill-builder");
  if (categories.size >= 3) eligible.add("curious-learner");
  if (registrations.length >= 5) eligible.add("workshop-champion");
  return eligible;
}

export async function GET(request) {
  try {
    await requireAdminPermission(request, "completion.review");
    const records = await queryCosmosDocuments("registrations",
      "SELECT TOP 150 * FROM c WHERE c.completionSource = @source ORDER BY c.reportedAt DESC",
      [{ name: "@source", value: "self_reported" }]
    );
    const names = new Map();
    const studentIds = [...new Set(records.map(record => record.studentId).filter(Boolean))];
    for (let offset = 0; offset < studentIds.length; offset += 6) {
      await Promise.all(studentIds.slice(offset, offset + 6).map(async id => {
        const student = await readCosmosDocument("students", id);
        names.set(id, {
          name: student?.fullName || [student?.firstName, student?.lastName].filter(Boolean).join(" ") || "Student",
          youthId: student?.youthId || "",
        });
      }));
    }
    return Response.json({
      success: true,
      completions: records.map(record => ({
        id: record.id, studentId: record.studentId, ...names.get(record.studentId),
        workshopId: record.workshopId,
        workshopTitle: record.workshopSnapshot?.title || "Workshop",
        programArea: record.workshopSnapshot?.programArea || "",
        completedOn: record.completedOn || null,
        reportedAt: record.reportedAt || null,
        status: record.status,
        reviewStatus: record.reviewStatus || "pending_review",
        xpAmount: Number(record.workshopSnapshot?.xpReward) || 0,
        reviewedBy: record.reviewedBy || null,
        reviewedAt: record.reviewedAt || null,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Completion claims could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const acting = await requireAdminPermission(request, "completion.review");
    const body = await request.json().catch(() => null);
    const registrationId = typeof body?.registrationId === "string" ? body.registrationId.trim() : "";
    if (!registrationId || registrationId.length > 128 || body?.action !== "approve") {
      return Response.json({ message: "A valid completion and review action are required." }, { status: 400 });
    }
    const record = await readCosmosDocument("registrations", registrationId);
    if (!record || record.completionSource !== "self_reported") {
      return Response.json({ message: "Self-reported completion not found." }, { status: 404 });
    }
    if (record.reviewStatus === "approved") return Response.json({ success: true, alreadyApproved: true });
    if (record.status !== "completed" || record.reviewStatus === "reversed") {
      return Response.json({ message: "Only active self-reported completions can be approved." }, { status: 409 });
    }
    try {
      await replaceCosmosDocument("registrations", record, {
        reviewStatus: "approved", reviewedBy: acting.uid, reviewedAt: cosmosNow(), updatedAt: cosmosNow(),
      });
    } catch (error) {
      if (isCosmosPreconditionFailed(error)) return Response.json({ message: "Claim changed. Refresh and retry." }, { status: 409 });
      throw error;
    }
    await recordAdminAudit({
      actorUid: acting.uid, action: "completion.approve", resource: "registration:" + registrationId, outcome: "success",
    });
    return Response.json({ success: true, message: "Completion approved. No additional XP was awarded." });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Completion could not be approved." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const acting = await requireAdminPermission(request, "completion.reverse");
    const body = await request.json().catch(() => null);
    const registrationId = typeof body?.registrationId === "string" ? body.registrationId.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!registrationId || registrationId.length > 128 || reason.length < 5 || reason.length > 250) {
      return Response.json({ message: "Select a completion and provide a reversal reason (5–250 characters)." }, { status: 400 });
    }
    const record = await readCosmosDocument("registrations", registrationId);
    if (!record || record.completionSource !== "self_reported") {
      return Response.json({ message: "Self-reported completion not found." }, { status: 404 });
    }
    if (record.status === "reversed") return Response.json({ success: true, alreadyReversed: true });
    if (record.status !== "completed") return Response.json({ message: "Only completed claims can be reversed." }, { status: 409 });

    const transactionId = completionTransactionId(record.studentId, record.workshopId, record.sessionId);
    const tx = await readCosmosDocument("xpTransactions", transactionId);
    if (!tx || tx.status !== "completed" || !Number.isSafeInteger(tx.points) || tx.points <= 0) {
      return Response.json({
        message: "The completion XP record is not finalized. Review the ledger before reversing to avoid an incorrect balance.",
      }, { status: 409 });
    }
    if (tx.completionSource && tx.completionSource !== "self_reported") {
      return Response.json({ message: "Completion source and XP transaction do not match." }, { status: 409 });
    }

    const student = await readCosmosDocument("students", record.studentId);
    if (!student) return Response.json({ message: "Student record is unavailable." }, { status: 404 });
    try { reverseEarnedXp(student, tx.points); }
    catch (error) { return Response.json({ message: error.message }, { status: 409 }); }

    // Lock the original award first. Never blindly replay a partially reversed
    // transaction: between Cosmos documents a true multi-partition transaction
    // is not available; pending reversals need explicit reconciliation.
    let reserved;
    try {
      reserved = await replaceCosmosDocument("xpTransactions", tx, {
        status: "reversing", reversalStartedAt: cosmosNow(),
        reversedBy: acting.uid, reversalReason: reason, updatedAt: cosmosNow(),
      });
    } catch (error) {
      if (isCosmosPreconditionFailed(error)) return Response.json({ message: "This XP award is being changed. Refresh the claim." }, { status: 409 });
      throw error;
    }

    let updatedStudent;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const fresh = await readCosmosDocument("students", record.studentId);
        if (!fresh) throw new Error("Student record disappeared.");
        const balances = reverseEarnedXp(fresh, tx.points);
        try {
          updatedStudent = await replaceCosmosDocument("students", fresh, {
            ...balances,
            level: calculateLevel(balances.totalXp),
            levelName: getLevelName(calculateLevel(balances.totalXp)),
            updatedAt: cosmosNow(),
          });
          break;
        } catch (error) {
          if (!isCosmosPreconditionFailed(error)) throw error;
        }
      }
      if (!updatedStudent) throw new Error("Student balance was updated concurrently.");
    } catch (error) {
      // Restoring a reserved transaction is safe if the student never updated;
      // a failed rollback still leaves the record in a locked review state.
      try {
        await replaceCosmosDocument("xpTransactions", reserved, {
          status: "completed", updatedAt: cosmosNow(),
        });
      } catch (rollback) { console.error("XP reversal reservation needs manual review:", transactionId, rollback?.message); }
      return Response.json({ message: "Reversal could not adjust the balance. Review ledger before retrying." }, { status: 409 });
    }

    try {
      await replaceCosmosDocument("xpTransactions", reserved, {
        status: "reversed", reversedAt: cosmosNow(), updatedAt: cosmosNow(),
      });
      const latestRecord = await readCosmosDocument("registrations", registrationId);
      if (!latestRecord || latestRecord.status !== "completed") {
        throw new Error("Completion changed during reversal.");
      }
      await replaceCosmosDocument("registrations", latestRecord, {
        status: "reversed", attendanceStatus: "reversed",
        reviewStatus: "reversed", reviewedBy: acting.uid, reviewedAt: cosmosNow(),
        reversalReason: reason, completionXpAwarded: false, updatedAt: cosmosNow(),
      });

      // Remove only automatic badges whose requirements are no longer met.
      // Manually granted/custom badges remain untouched.
      const remaining = await queryCosmosDocuments("registrations",
        "SELECT * FROM c WHERE c.studentId = @id AND c.status = 'completed'",
        [{ name: "@id", value: record.studentId }]
      );
      const eligible = badgeEligibility(remaining);
      const refreshedStudent = await readCosmosDocument("students", record.studentId);
      const oldBadges = Array.isArray(refreshedStudent?.badges) ? refreshedStudent.badges : [];
      const removed = oldBadges.filter(id => AUTO_BADGES.has(id) && !eligible.has(id));
      const remainingBadges = oldBadges.filter(id => !removed.includes(id));
      if (refreshedStudent) {
        await replaceCosmosDocument("students", refreshedStudent, {
          completedWorkshopCount: remaining.length,
          badges: remainingBadges,
          badgeCount: remainingBadges.length,
          updatedAt: cosmosNow(),
        });
      }
      for (const badgeId of removed) {
        await deleteCosmosDocument("studentBadges", record.studentId + "_" + badgeId);
      }
      await recordAdminAudit({
        actorUid: acting.uid, action: "completion.reverse", resource: "registration:" + registrationId, outcome: "success",
      });
      return Response.json({
        success: true, totalXp: updatedStudent.totalXp,
        currentXp: updatedStudent.currentXp, xpCorrectionDebt: updatedStudent.xpCorrectionDebt,
        message: "Completion reversed; XP and earned badges reconciled. Future XP will offset any correction.",
      });
    } catch (error) {
      console.error("Completion reversal requires manual reconciliation:", registrationId, error?.message);
      return Response.json({
        success: false, reviewPending: true,
        message: "An XP correction may already have been applied. Do not repeat this reversal. Review the ledger and registration before proceeding.",
      }, { status: 202 });
    }
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Completion reversal could not be completed." }, { status: 500 });
  }
}
