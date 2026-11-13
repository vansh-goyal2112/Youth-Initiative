import { requireActiveStudent, studentAccessResponse } from "@/services/studentAccess";
import {
  queryCosmosDocuments, createCosmosDocument, readCosmosDocument,
  replaceCosmosDocument, cosmosNow, isCosmosConflict, isCosmosPreconditionFailed,
} from "@/services/cosmosData";
import { workshopCompletionSnapshot } from "@/services/workshopHistory.mjs";
import { processWorkshopCompletion } from "@/services/gamificationAdmin";
import { completionTransactionId, awardForCompletion } from "@/services/completionRules.mjs";

export const runtime = "nodejs";

// A limited public student catalogue for backfilling genuine past attendance.
// This is intentionally distinct from the active, grade-filtered registration catalogue.
export async function GET(request) {
  try {
    const { uid } = await requireActiveStudent(request);
    const [workshops, registrations] = await Promise.all([
      queryCosmosDocuments("workshops",
        "SELECT c.id, c.title, c.programArea, c.category, c.status, c.xpReward, c.startDate, c.endDate, c.grade FROM c WHERE NOT IS_DEFINED(c.status) OR c.status != 'deleted'"),
      queryCosmosDocuments("registrations",
        "SELECT c.workshopId, c.sessionId, c.status, c.reviewStatus FROM c WHERE c.studentId = @id",
        [{ name: "@id", value: uid }]),
    ]);
    const previouslyClaimed = new Set(registrations.filter(item =>
      item.status === "completed" || item.status === "reversed"
    ).map(item => item.workshopId));
    return Response.json({
      success: true,
      workshops: workshops
        .filter(item => item.id && item.title && !previouslyClaimed.has(item.id))
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(item => ({
          id: item.id, title: item.title, programArea: item.programArea || "",
          grade: item.grade || "", xpReward: awardForCompletion(item, "self_reported"),
          startDate: item.startDate || null, status: item.status || "active",
        })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return studentAccessResponse(error) ||
      Response.json({ message: "Past workshops could not be loaded." }, { status: 500 });
  }
}

// Self-reporting awards half XP *immediately*. Review status remains pending
// so authorized staff can subsequently verify or reverse the claim.
export async function POST(request) {
  try {
    const { uid } = await requireActiveStudent(request, { consumeAppCheck: true });
    const body = await request.json().catch(() => null);
    const workshopId = typeof body?.workshopId === "string" ? body.workshopId.trim() : "";
    const completedOn = typeof body?.completedOn === "string" ? body.completedOn.trim() : "";
    if (!workshopId || workshopId.length > 128 || !/^\d{4}-\d{2}-\d{2}$/.test(completedOn) || body?.attested !== true) {
      return Response.json({ message: "Select a workshop, enter its completion date and confirm that you attended." }, { status: 400 });
    }
    const timestamp = Date.parse(completedOn + "T12:00:00Z");
    const maxDay = new Date().toISOString().slice(0, 10);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== completedOn ||
        completedOn > maxDay || completedOn < "2000-01-01") {
      return Response.json({ message: "Completion date must be a real date in the past." }, { status: 400 });
    }

    const workshop = await readCosmosDocument("workshops", workshopId);
    if (!workshop || !["active", "inactive"].includes(workshop.status || "active")) {
      return Response.json({ message: "This workshop is no longer available for a new completion claim." }, { status: 404 });
    }

    const registrations = await queryCosmosDocuments("registrations",
      "SELECT * FROM c WHERE c.studentId = @studentId AND c.workshopId = @workshopId",
      [{ name: "@studentId", value: uid }, { name: "@workshopId", value: workshopId }]);
    if (registrations.some(item => item.status === "completed" || item.status === "reversed")) {
      return Response.json({ message: "A completion already exists for this workshop. Ask the program team if it needs correction." }, { status: 409 });
    }
    const transactionId = completionTransactionId(uid, workshopId);
    if (await readCosmosDocument("xpTransactions", transactionId)) {
      return Response.json({ message: "An XP award already exists for this workshop and requires review." }, { status: 409 });
    }

    const existing = registrations.find(item => item.status === "upcoming");
    const registrationId = existing?.id || "self:" + uid + ":" + workshopId;
    const now = cosmosNow();
    const completedAt = new Date(timestamp).toISOString();
    const award = awardForCompletion(workshop, "self_reported");
    const changes = {
      studentId: uid, workshopId, status: "completed",
      completionSource: "self_reported", attendanceStatus: "self_reported",
      reviewStatus: "pending_review", completedOn,
      reportedAt: now, attendedAt: completedAt, completedAt,
      completionXpAwarded: false,
      workshopSnapshot: {
        ...workshopCompletionSnapshot(workshop, {
          id: registrationId, workshopId, status: "completed", completedAt,
        }, null),
        xpReward: award,
      },
      updatedAt: now,
    };
    let registration;
    try {
      registration = existing
        ? await replaceCosmosDocument("registrations", existing, changes)
        : await createCosmosDocument("registrations", {
          id: registrationId, ...changes, createdAt: now,
        });
    } catch (error) {
      if (isCosmosConflict(error) || isCosmosPreconditionFailed(error)) {
        return Response.json({ message: "This workshop claim was already submitted. Refresh to see its status." }, { status: 409 });
      }
      throw error;
    }

    // The immutable award reservation prevents duplicate credit, including
    // requests racing each other or retrying after an interrupted response.
    let rewardPending = false;
    try {
      await processWorkshopCompletion({
        studentId: uid, workshopId, workshop,
        completionSource: "self_reported", registrationId,
      });
      const tx = await readCosmosDocument("xpTransactions", transactionId);
      if (tx?.status === "completed") {
        const latest = await readCosmosDocument("registrations", registration.id);
        if (latest?.status === "completed" && latest?.completionSource === "self_reported") {
          await replaceCosmosDocument("registrations", latest, {
            completionXpAwarded: true, updatedAt: cosmosNow(),
          });
        }
      } else rewardPending = true;
    } catch (error) {
      rewardPending = true;
      console.error("Self-reported attendance saved but XP requires review:", registration.id, error?.message);
    }

    return Response.json({
      success: true, registrationId, xpAmount: award, rewardPending,
      reviewStatus: "pending_review",
      message: rewardPending
        ? "Your completion was saved for review. Your half-XP award needs reconciliation."
        : "Workshop recorded! Half XP earned. Your completion is available for admin review.",
    }, { status: rewardPending ? 202 : 201 });
  } catch (error) {
    const denied = studentAccessResponse(error);
    if (denied) return denied;
    console.error("Self-reported workshop completion failed:", error?.message);
    return Response.json({ message: "Completion could not be saved. Check existing claims before trying again." }, { status: 500 });
  }
}
