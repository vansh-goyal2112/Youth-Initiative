import {
  processWorkshopCompletion,
} from "@/services/gamificationAdmin";

import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import {
  cosmosNow,
  isCosmosPreconditionFailed,
  queryCosmosDocuments,
  readCosmosDocument,
  replaceCosmosDocument,
} from "@/services/cosmosData";

export const runtime = "nodejs";

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
    } = await request.json();

    if (
      !attendanceSessionId ||
      !code
    ) {
      return Response.json(
        {
          success: false,

          message:
            "Invalid attendance QR code.",
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

    const session =
      await readCosmosDocument(
        "attendanceSessions",
        attendanceSessionId
      );

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
          SELECT TOP 1 *
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

    if (
      registrations.length ===
      0
    ) {
      return Response.json(
        {
          success: false,

          message:
            "You are not registered for this workshop.",
        },
        {
          status: 403,
        }
      );
    }

    const registration =
      registrations[0];

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

    const workshop =
      await readCosmosDocument(
        "workshops",
        session.workshopId
      );

    if (!workshop) {
      return Response.json(
        {
          success: false,

          message:
            "Workshop could not be found.",
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

          attendedAt:
            completedAt,

          completedAt,

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
      });

      // A duplicate or in-progress transaction can report zero new XP.
      // Do not mark the registration paid unless the ledger confirms it.
      const rewardTransaction = await readCosmosDocument(
        "xpTransactions",
        `${studentId}_${session.workshopId}`
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