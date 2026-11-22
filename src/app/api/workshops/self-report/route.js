import { requireActiveStudent, studentAccessResponse } from "@/services/studentAccess";
import {
  queryCosmosDocuments, createCosmosDocument, readCosmosDocument,
  replaceCosmosDocument, cosmosNow, isCosmosConflict, isCosmosPreconditionFailed,
} from "@/services/cosmosData";
import { workshopCompletionSnapshot } from "@/services/workshopHistory.mjs";
import { processWorkshopCompletion } from "@/services/gamificationAdmin";
import { completionTransactionId, awardForCompletion } from "@/services/completionRules.mjs";
import { resolveWorkshopSessions } from "@/services/workshopSessions.mjs";
import { ensureWorkshopCatalogueXp, ensureWorkshopXpAssigned } from "@/services/workshopXpMigration";
import { getSelfClaimCategory, getClaimedWorkshopIds } from "@/utils/workshopSelfClaim.mjs";
import { schoolGradeNumber } from "@/utils/workshopGrades.mjs";

export const runtime = "nodejs";

// A limited public student catalogue for backfilling genuine past attendance.
// This is intentionally distinct from the active, grade-filtered registration catalogue.
export async function GET(request) {
  try {
    const { uid, student } = await requireActiveStudent(request);
    // A historical claim can involve an earlier grade, but not a future one.
    // Never use the normal registration catalogue for this list.
    if (schoolGradeNumber(student?.schoolGrade) === null) {
      return Response.json({ success: true, gradeRequired: true, workshops: [] },
        { headers: { "Cache-Control": "private, no-store" } });
    }
    const [workshops, registrations] = await Promise.all([
      queryCosmosDocuments("workshops",
        "SELECT * FROM c WHERE NOT IS_DEFINED(c.status) OR c.status != 'deleted'"),
      queryCosmosDocuments("registrations",
        "SELECT c.workshopId, c.status, c.reviewStatus, c.attendanceStatus FROM c WHERE c.studentId = @id",
        [{ name: "@id", value: uid }]),
    ]);
    const resolvedWorkshops = await ensureWorkshopCatalogueXp(workshops);
    // A workshop can have several sessions, but only one past completion
    // claim is allowed per program. Hide the entire claimed workshop.
    const claimedWorkshops = getClaimedWorkshopIds(registrations);
    const today = new Date().toISOString().slice(0, 10);
    return Response.json({
      success: true,
      workshops: resolvedWorkshops
        .filter(item => item.id && item.title && !claimedWorkshops.has(item.id) && getSelfClaimCategory(item, student.schoolGrade))
        .map(item => {
          const claimCategory = getSelfClaimCategory(item, student.schoolGrade);
          const knownSessions = resolveWorkshopSessions(item);
          const sessions = knownSessions.filter(session => !session.startDate || session.startDate <= today);
          const hasSessions = knownSessions.length > 0;
          if (hasSessions && sessions.length === 0) return null;
          return {
            id: item.id, title: item.title, programArea: item.programArea || "",
            grade: item.grade || "", claimCategory,
            xpReward: awardForCompletion(item, "self_reported"),
            startDate: item.startDate || null, status: item.status || "active",
            sessions: hasSessions ? sessions.map(session => ({
              id: session.id, startDate: session.startDate,
              endDate: session.endDate || session.startDate, time: session.time || "",
              status: session.status || "active",
            })) : [],
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.title.localeCompare(b.title)),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return studentAccessResponse(error) ||
      Response.json({ message: "Past experiences could not be loaded." }, { status: 500 });
  }
}

// Self-reporting awards half XP *immediately*. Review status remains pending
// so authorized staff can subsequently verify or reverse the claim.
export async function POST(request) {
  try {
    const { uid, student } = await requireActiveStudent(request, { consumeAppCheck: true });
    const body = await request.json().catch(() => null);
    const workshopId = typeof body?.workshopId === "string" ? body.workshopId.trim() : "";
    const requestedSessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : null;
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

    const workshop = await ensureWorkshopXpAssigned(await readCosmosDocument("workshops", workshopId));
    if (!workshop || !["active", "inactive"].includes(workshop.status || "active")) {
      return Response.json({ message: "This experience is no longer available for a new completion claim." }, { status: 404 });
    }
    if (schoolGradeNumber(student?.schoolGrade) === null) {
      return Response.json({ message: "Add your current school grade in My Identity before claiming a past experience." }, { status: 409 });
    }
    if (!getSelfClaimCategory(workshop, student.schoolGrade)) {
      return Response.json({ message: "This experience is not eligible for a past-attendance claim for your grade." }, { status: 403 });
    }

    const knownSessions = resolveWorkshopSessions(workshop);
    const scheduled = knownSessions.find(session => session.id === requestedSessionId);
    if (knownSessions.length > 0 && !scheduled) {
      return Response.json({ message: "Select the session date you attended." }, { status: 400 });
    }
    if (knownSessions.length === 0 && requestedSessionId && requestedSessionId !== "legacy") {
      return Response.json({ message: "This experience has no matching session." }, { status: 400 });
    }
    if (scheduled && (completedOn < scheduled.startDate || completedOn > (scheduled.endDate || scheduled.startDate))) {
      return Response.json({ message: "Enter a completion date within the selected experience session." }, { status: 400 });
    }
    const sessionId = scheduled?.id === "legacy" ? null : scheduled?.id || null;

    const registrations = await queryCosmosDocuments("registrations",
      "SELECT * FROM c WHERE c.studentId = @studentId AND c.workshopId = @workshopId",
      [{ name: "@studentId", value: uid }, { name: "@workshopId", value: workshopId }]);
    // Enforce the same workshop-level rule on the server even if the
    // student bypasses the dropdown or selects another session.
    if (getClaimedWorkshopIds(registrations).has(workshopId)) {
      return Response.json({
        message: "This experience has already been claimed or completed. Ask the program team if it needs correction.",
        alreadyClaimed: true,
      }, { status: 409 });
    }
    const transactionId = completionTransactionId(uid, workshopId, sessionId);
    if (await readCosmosDocument("xpTransactions", transactionId)) {
      return Response.json({ message: "An XP award already exists for this experience and requires review." }, { status: 409 });
    }

    const existing = registrations.find(item => item.status === "upcoming" && (item.sessionId || null) === sessionId);
    const registrationId = existing?.id || "self:" + uid + ":" + workshopId + ":" + (sessionId || "legacy");
    const now = cosmosNow();
    const completedAt = new Date(timestamp).toISOString();
    const award = awardForCompletion(workshop, "self_reported");
    const changes = {
      studentId: uid, workshopId, sessionId, status: "completed",
      completionSource: "self_reported", attendanceStatus: "self_reported",
      reviewStatus: "pending_review", completedOn,
      reportedAt: now, attendedAt: completedAt, completedAt,
      completionXpAwarded: false,
      workshopSnapshot: {
        ...workshopCompletionSnapshot(workshop, {
          id: registrationId, workshopId, status: "completed", completedAt,
        }, null),
        xpReward: award,
        ...(scheduled ? {
          startDate: scheduled.startDate, endDate: scheduled.endDate,
          time: scheduled.time || workshop.time,
        } : {}),
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
        return Response.json({ message: "This experience claim was already submitted. Refresh to see its status." }, { status: 409 });
      }
      throw error;
    }

    // The immutable award reservation prevents duplicate credit, including
    // requests racing each other or retrying after an interrupted response.
    let rewardPending = false;
    try {
      await processWorkshopCompletion({
        studentId: uid, workshopId, workshop,
        completionSource: "self_reported", registrationId, sessionId,
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
        : "Experience recorded! Half XP earned. Your completion is available for admin review.",
    }, { status: rewardPending ? 202 : 201 });
  } catch (error) {
    const denied = studentAccessResponse(error);
    if (denied) return denied;
    console.error("Self-reported experience completion failed:", error?.message);
    return Response.json({ message: "Completion could not be saved. Check existing claims before trying again." }, { status: 500 });
  }
}
