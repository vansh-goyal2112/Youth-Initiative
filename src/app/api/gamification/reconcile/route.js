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

import { processWorkshopCompletion } from "@/services/gamificationAdmin";
import { classifyRewardRecovery } from "@/services/rewardRecovery.mjs";

export const runtime = "nodejs";

const MAX_RECOVERIES_PER_REQUEST = 8;

/**
 * Only verified attendance may create an XP award.
 * A processing XP transaction is NOT retried blindly: its student
 * balance may already have changed even when finalization failed.
 */
export async function POST(request) {
  const startedAt = performance.now();
  let authDurationMs = 0;
  let queryDurationMs = 0;
  try {
    const { uid: studentId } = await requireActiveStudent(request);
    authDurationMs = performance.now() - startedAt;

    const completedRegistrations = await queryCosmosDocuments(
      "registrations",
      `SELECT TOP ${MAX_RECOVERIES_PER_REQUEST + 1} * FROM c
       WHERE c.studentId = @studentId
         AND c.status = @status
         AND c.attendanceStatus = @attendanceStatus`,
      [
        { name: "@studentId", value: studentId },
        { name: "@status", value: "completed" },
        { name: "@attendanceStatus", value: "verified" },
      ]
    );

    queryDurationMs = performance.now() - startedAt - authDurationMs;
    const results = [];

    for (const registration of completedRegistrations.slice(
      0,
      MAX_RECOVERIES_PER_REQUEST
    )) {
      const workshopId = registration.workshopId;
      const transactionId = `${studentId}_${workshopId}`;

      try {
        const existingTransaction = await readCosmosDocument(
          "xpTransactions",
          transactionId
        );

        const action = classifyRewardRecovery(
          registration,
          existingTransaction
        );

        if (action === "ineligible") {
          continue;
        }

        if (action === "pending") {
          results.push({
            workshopId,
            status: "pending",
            message: "Reward requires review before it can be retried.",
          });
          continue;
        }

        if (action === "award") {
          const workshop = await readCosmosDocument(
            "workshops",
            workshopId
          );

          if (!workshop) {
            results.push({
              workshopId,
              status: "pending",
              message: "Workshop record not found.",
            });
            continue;
          }

          await processWorkshopCompletion({
            studentId,
            workshopId,
            workshop,
          });
        }

        // A completed transaction was already verified above. Only
        // re-read after attempting a new award, which can mutate it.
        const finalTransaction = action === "synchronize"
          ? existingTransaction
          : await readCosmosDocument("xpTransactions", transactionId);

        if (finalTransaction?.status !== "completed") {
          results.push({
            workshopId,
            status: "pending",
            message: "Reward transaction is not yet finalized.",
          });
          continue;
        }

        if (registration.completionXpAwarded !== true) {
          const latestRegistration = await readCosmosDocument(
            "registrations",
            registration.id
          );

          if (
            latestRegistration?.status === "completed" &&
            latestRegistration.attendanceStatus === "verified"
          ) {
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
              if (!isCosmosPreconditionFailed(error)) {
                throw error;
              }
            }
          }
        }

        results.push({ workshopId, status: "complete" });
      } catch (error) {
        console.error(
          "Reward recovery failed for a verified workshop:",
          workshopId,
          error
        );

        results.push({
          workshopId,
          status: "pending",
          message: "Reward could not be finalized. Try again later.",
        });
      }
    }

    if (process.env.NODE_ENV !== "test") {
      console.info("[reward-reconcile] timings", {
        authMs: Math.round(authDurationMs),
        registrationQueryMs: Math.round(queryDurationMs),
        processingMs: Math.round(performance.now() - startedAt - authDurationMs - queryDurationMs),
        checked: Math.min(completedRegistrations.length, MAX_RECOVERIES_PER_REQUEST),
      });
    }

    return Response.json({
      success: true,
      results,
      pendingCount: results.filter((result) => result.status === "pending").length,
      moreToReview: completedRegistrations.length > MAX_RECOVERIES_PER_REQUEST,
    });
  } catch (error) {
    const accessResponse = studentAccessResponse(error);
    if (accessResponse) return accessResponse;

    console.error("Reward reconciliation error:", error);
    return Response.json(
      { success: false, message: "Reward recovery is unavailable." },
      { status: 500 }
    );
  }
}
