import { workshopCompletionSnapshot } from "@/services/workshopHistory.mjs";
import { completionTransactionId } from "@/services/completionRules.mjs";
import { ensureWorkshopXpAssigned } from "@/services/workshopXpMigration";
import {
  processWorkshopCompletion,
} from "@/services/gamificationAdmin";

import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import {
  cosmosNow,
  createCosmosDocument,
  isCosmosConflict,
  isCosmosPreconditionFailed,
  queryCosmosDocuments,
  readCosmosDocument,
  replaceCosmosDocument,
} from "@/services/cosmosData";

import {
  isValidManualAttendanceCode,
  nextManualCodeAttempt,
} from "@/services/attendanceManualCode.mjs";

export const runtime = "nodejs";

// A four-digit code has only 10,000 combinations. Reserve each attempt
// against a durable, per-student 15-minute counter before looking up the code.
async function reserveManualCodeAttempt(studentId) {
  const id = "attendance-code-attempts:" + studentId;
  const existing = await readCosmosDocument("attendanceSessions", id);
  const check = nextManualCodeAttempt(existing);
  if (!check.allowed) return false;
  try {
    if (existing) {
      await replaceCosmosDocument("attendanceSessions", existing, {
        ...check.next, updatedAt: cosmosNow(),
      });
    } else {
      await createCosmosDocument("attendanceSessions", {
        id, ...check.next, createdAt: cosmosNow(),
      });
    }
    return true;
  } catch (error) {
    // Concurrent attempts do not skip rate limiting.
    if (isCosmosConflict(error) || isCosmosPreconditionFailed(error)) return false;
    throw error;
  }
}

export async function POST(request) {
  try {
    const {
      uid: studentId,
    } =
      await requireActiveStudent(
        request,
        {
          consumeAppCheck:
            true,
        }
      );

    const {
      attendanceSessionId,
      code,
      manualCode,
    } = await request.json();

    const manual = manualCode !== undefined;
    if (manual ? !isValidManualAttendanceCode(manualCode) : (!attendanceSessionId || !code)) {
      return Response.json(
        {
          success: false,

          message:
            manual ? "Enter a four-digit attendance code." : "Invalid attendance QR code.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Read the attendance session
      from Cosmos DB.
    */

    let session;
    if (manual) {
      if (!(await reserveManualCodeAttempt(studentId))) {
        return Response.json({ success: false,
          message: "Too many code attempts. Please wait 15 minutes or scan the QR code.",
        }, { status: 429 });
      }
      const matches = await queryCosmosDocuments("attendanceSessions",
        "SELECT TOP 2 * FROM c WHERE c.manualCode = @code AND c.active = true AND c.expiresAt > @now",
        [{ name: "@code", value: manualCode }, { name: "@now", value: cosmosNow() }]);
      if (matches.length !== 1) {
        return Response.json({ success: false,
          message: matches.length > 1
            ? "This code is ambiguous. Ask the instructor to generate a new one."
            : "Incorrect or expired attendance code.",
        }, { status: matches.length > 1 ? 409 : 401 });
      }
      session = matches[0];
    } else {
      session = await readCosmosDocument("attendanceSessions", attendanceSessionId);
    }

    if (!session) {
      return Response.json(
        {
          success: false,

          message:
            "Attendance session not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!session.active) {
      return Response.json(
        {
          success: false,

          message:
            "This attendance QR is no longer active.",
        },
        {
          status: 410,
        }
      );
    }

    if (
      !manual &&
      session.code !==
      code
    ) {
      return Response.json(
        {
          success: false,

          message:
            "Invalid attendance code.",
        },
        {
          status: 401,
        }
      );
    }

    const expiryDate =
      new Date(
        session.expiresAt
      );

    if (
      Number.isNaN(
        expiryDate.getTime()
      ) ||
      expiryDate.getTime() <
        Date.now()
    ) {
      return Response.json(
        {
          success: false,

          message:
            "This attendance QR has expired.",
        },
        {
          status: 410,
        }
      );
    }

    /*
      Find this student's workshop
      registration.

      Firestore previously queried
      by studentId + workshopId.
    */

    const registrations =
      await queryCosmosDocuments(
        "registrations",
        `
          SELECT *
          FROM c
          WHERE c.studentId = @studentId
            AND c.workshopId = @workshopId
        `,
        [
          {
            name:
              "@studentId",

            value:
              studentId,
          },
          {
            name:
              "@workshopId",

            value:
              session.workshopId,
          },
        ]
      );

    const matching = registrations.find(item =>
      (item.sessionId || null) === (session.catalogSessionId || null) && item.status === "upcoming"
    );
    if (!matching) {
      return Response.json(
        {
          success: false,

          message:
            "You are not registered for this experience.",
        },
        {
          status: 403,
        }
      );
    }

    const registration = matching;

    if (
      registration.status ===
      "completed"
    ) {
      return Response.json(
        {
          success: false,

          message:
            "Attendance has already been recorded.",
        },
        {
          status: 409,
        }
      );
    }

    /*
      Load workshop information.
    */

    const workshop = await ensureWorkshopXpAssigned(
      await readCosmosDocument("workshops", session.workshopId)
    );

    if (!workshop) {
      return Response.json(
        {
          success: false,

          message:
            "Experience could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
      Mark registration completed.

      The Cosmos ETag prevents two
      simultaneous attendance scans
      from updating the same
      registration version.
    */

    const completedAt =
      cosmosNow();

    try {
      await replaceCosmosDocument(
        "registrations",
        registration,
        {
          status:
            "completed",

          attendanceStatus:
            "verified",

          attendanceSessionId,
          completionSource: "qr",
          sessionId: registration.sessionId || null,

          attendedAt:
            completedAt,

          completedAt,
          workshopSnapshot: workshopCompletionSnapshot(workshop, { ...registration, status: "completed", completedAt }, null),

          completionXpAwarded:
            false,

          updatedAt:
            completedAt,
        }
      );
    } catch (error) {
      if (
        isCosmosPreconditionFailed(
          error
        )
      ) {
        return Response.json(
          {
            success: false,

            message:
              "Attendance has already been recorded.",
          },
          {
            status: 409,
          }
        );
      }

      throw error;
    }

    /*
      Attendance and XP live in separate Cosmos documents.
      Recording attendance must succeed even when the reward
      service is temporarily unavailable. The authenticated
      reconciliation endpoint can safely retry this verified
      completion later.
    */
    let reward = null;
    let rewardPending = false;

    try {
      reward = await processWorkshopCompletion({
        studentId,
        workshopId: session.workshopId,
        workshop,
        completionSource: "qr",
        sessionId: registration.sessionId || null,
        registrationId: registration.id,
      });

      // A duplicate or in-progress transaction can report zero new XP.
      // Do not mark the registration paid unless the ledger confirms it.
      const rewardTransaction = await readCosmosDocument(
        "xpTransactions",
        completionTransactionId(studentId, session.workshopId, registration.sessionId || null)
      );

      if (rewardTransaction?.status !== "completed") {
        rewardPending = true;
        reward = null;
      }

      const latestRegistration = !rewardPending && await readCosmosDocument(
        "registrations",
        registration.id
      );

      if (latestRegistration && latestRegistration.attendanceStatus === "verified") {
        try {
          await replaceCosmosDocument(
            "registrations",
            latestRegistration,
            {
              completionXpAwarded: true,
              updatedAt: cosmosNow(),
            }
          );
        } catch (error) {
          // The deterministic XP transaction prevents double awards.
          // A future reconciliation can update the registration flag.
          console.error("Could not synchronize attendance reward flag:", error);
        }
      }
    } catch (error) {
      rewardPending = true;
      console.error("Attendance was saved but XP needs reconciliation:", error);
    }

    return Response.json({
      success: true,
      message: rewardPending
        ? "Attendance verified. Your reward is still being processed."
        : "Attendance verified successfully!",
      rewardPending,
      workshop: {
        id: session.workshopId,
        title: workshop.title,
        category: workshop.category,
      },
      reward,
    });
  } catch (error) {
    const accessResponse =
      studentAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Attendance verification error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Attendance could not be verified.",
      },
      {
        status: 500,
      }
    );
  }
}