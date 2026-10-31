import crypto from "crypto";

import {
  cosmosNow,
  createCosmosDocument,
  deleteCosmosDocument,
  isCosmosConflict,
  isCosmosPreconditionFailed,
  queryCosmosDocuments,
  readCosmosDocument,
  replaceCosmosDocument,
} from "@/services/cosmosData";

function calculateLevel(totalXp) {
  if (totalXp >= 1000) return 6;
  if (totalXp >= 700) return 5;
  if (totalXp >= 450) return 4;
  if (totalXp >= 250) return 3;
  if (totalXp >= 100) return 2;

  return 1;
}

function getLevelName(level) {
  const levels = {
    1: "New Explorer",
    2: "Skill Starter",
    3: "Future Creator",
    4: "Innovation Builder",
    5: "Pathway Explorer",
    6: "Youth Champion",
  };

  return levels[level] || "New Explorer";
}

async function removeXpReservation(
  transactionId,
  operationId
) {
  try {
    const transaction =
      await readCosmosDocument(
        "xpTransactions",
        transactionId
      );

    /*
      Only remove the reservation
      created by this operation.
    */

    if (
      transaction &&
      transaction.operationId ===
        operationId &&
      transaction.status ===
        "processing"
    ) {
      await deleteCosmosDocument(
        "xpTransactions",
        transactionId
      );
    }
  } catch (error) {
    console.error(
      "Could not release XP reservation:",
      error?.message
    );
  }
}

export async function processWorkshopCompletion({
  studentId,
  workshopId,
  workshop,
}) {
  const transactionId =
    `${studentId}_${workshopId}`;

  /*
    Retry if the student document
    changes concurrently.

    This gives Cosmos ETag protection
    similar to the consistency that
    the Firestore batch previously
    provided for the student update.
  */

  for (
    let attempt = 0;
    attempt < 3;
    attempt += 1
  ) {
    const student =
      await readCosmosDocument(
        "students",
        studentId
      );

    if (!student) {
      throw new Error(
        "Student profile not found."
      );
    }

    const xpReward =
      Number(
        workshop.xpReward
      ) || 100;

    const currentXp =
      Number(
        student.totalXp
      ) || 0;

    /*
      Existing deterministic XP
      transaction means this workshop
      has already been processed.

      This preserves the original
      duplicate-reward protection.
    */

    const existingXp =
      await readCosmosDocument(
        "xpTransactions",
        transactionId
      );

    if (existingXp) {
      return {
        xpEarned:
          0,

        totalXp:
          currentXp,

        level:
          student.level ||
          1,

        levelName:
          getLevelName(
            student.level ||
              1
          ),

        newBadges:
          [],
      };
    }

    const newTotalXp =
      currentXp +
      xpReward;

    const newLevel =
      calculateLevel(
        newTotalXp
      );

    const completedWorkshopCount =
      (
        Number(
          student.completedWorkshopCount
        ) ||
        0
      ) + 1;

    /*
      Find completed registrations
      for this student.
    */

    const completedRegistrations =
      await queryCosmosDocuments(
        "registrations",
        `
          SELECT *
          FROM c
          WHERE c.studentId = @studentId
            AND c.status = @status
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
              "@status",

            value:
              "completed",
          },
        ]
      );

    const completedCategories =
      new Set();

    for (
      const registration of
      completedRegistrations
    ) {
      if (
        !registration.workshopId
      ) {
        continue;
      }

      const completedWorkshop = registration.workshopSnapshot ||
        await readCosmosDocument("workshops", registration.workshopId);

      if (
        completedWorkshop
      ) {
        const category =
          completedWorkshop.category;

        if (category) {
          completedCategories.add(
            category
          );
        }
      }
    }

    if (
      workshop.category
    ) {
      completedCategories.add(
        workshop.category
      );
    }

    const currentBadges =
      Array.isArray(
        student.badges
      )
        ? [
            ...student.badges,
          ]
        : [];

    const newBadges =
      [];

    function awardBadge(
      id,
      name
    ) {
      if (
        !currentBadges.includes(
          id
        )
      ) {
        currentBadges.push(
          id
        );

        newBadges.push({
          id,
          name,
        });
      }
    }

    if (
      completedWorkshopCount >=
      1
    ) {
      awardBadge(
        "first-step",
        "First Step"
      );
    }

    if (
      workshop.category ===
      "Technology"
    ) {
      awardBadge(
        "tech-explorer",
        "Tech Explorer"
      );
    }

    if (
      completedWorkshopCount >=
      3
    ) {
      awardBadge(
        "skill-builder",
        "Skill Builder"
      );
    }

    if (
      completedCategories.size >=
      3
    ) {
      awardBadge(
        "curious-learner",
        "Curious Learner"
      );
    }

    if (
      completedWorkshopCount >=
      5
    ) {
      awardBadge(
        "workshop-champion",
        "Workshop Champion"
      );
    }

    /*
      Reserve the deterministic XP
      transaction before changing
      the student's XP.

      If another request has already
      created it, no XP is awarded
      again.
    */

    const operationId =
      crypto.randomUUID();

    const createdAt =
      cosmosNow();

    let xpTransaction;

    try {
      xpTransaction =
        await createCosmosDocument(
          "xpTransactions",
          {
            id:
              transactionId,

            studentId,

            workshopId,

            action:
              "workshop_completion",

            points:
              xpReward,

            status:
              "processing",

            operationId,

            createdAt,

            updatedAt:
              createdAt,
          }
        );
    } catch (error) {
      if (
        isCosmosConflict(
          error
        )
      ) {
        const latestStudent =
          await readCosmosDocument(
            "students",
            studentId
          );

        return {
          xpEarned:
            0,

          totalXp:
            Number(
              latestStudent
                ?.totalXp
            ) ||
            currentXp,

          level:
            latestStudent
              ?.level ||
            student.level ||
            1,

          levelName:
            getLevelName(
              latestStudent
                ?.level ||
                student.level ||
                1
            ),

          newBadges:
            [],
        };
      }

      throw error;
    }

    /*
      Update the student using the
      ETag from the document we read.

      If another request changed the
      student first, release this XP
      reservation and retry.
    */

    let updatedStudent;

    const updatedAt =
      cosmosNow();

    try {
      updatedStudent =
        await replaceCosmosDocument(
          "students",
          student,
          {
            totalXp:
              newTotalXp,

            level:
              newLevel,

            levelName:
              getLevelName(
                newLevel
              ),

            completedWorkshopCount,

            badgeCount:
              currentBadges.length,

            badges:
              currentBadges,

            updatedAt,
          }
        );
    } catch (error) {
      await removeXpReservation(
        transactionId,
        operationId
      );

      if (
        isCosmosPreconditionFailed(
          error
        )
      ) {
        continue;
      }

      throw error;
    }

    /*
      Create badge records.

      Their IDs are deterministic,
      so an existing badge is treated
      the same as Firestore's previous
      merge behavior.
    */

    for (
      const badge of
      newBadges
    ) {
      const badgeId =
        `${studentId}_${badge.id}`;

      try {
        await createCosmosDocument(
          "studentBadges",
          {
            id:
              badgeId,

            studentId,

            badgeId:
              badge.id,

            name:
              badge.name,

            earnedAt:
              cosmosNow(),
          }
        );
      } catch (error) {
        if (
          !isCosmosConflict(
            error
          )
        ) {
          /*
            The student document already
            contains the badge and XP.

            Do not undo a successfully
            awarded reward because an
            auxiliary badge-history write
            failed.
          */

          console.error(
            `Could not create badge record ${badgeId}:`,
            error?.message
          );
        }
      }
    }

    /*
      Mark the XP transaction complete.

      The deterministic transaction
      document remains the permanent
      duplicate-award guard.
    */

    try {
      const completedAt =
        cosmosNow();

      await replaceCosmosDocument(
        "xpTransactions",
        xpTransaction,
        {
          status:
            "completed",

          operationId:
            null,

          completedAt,

          updatedAt:
            completedAt,
        }
      );
    } catch (error) {
      /*
        XP has already been written
        to the student.

        Leaving the deterministic XP
        transaction in place is safer
        than deleting it and risking a
        duplicate reward.
      */

      console.error(
        "Could not finalize XP transaction:",
        error?.message
      );
    }

    return {
      xpEarned:
        xpReward,

      totalXp:
        updatedStudent
          ?.totalXp ??
        newTotalXp,

      level:
        updatedStudent
          ?.level ??
        newLevel,

      levelName:
        updatedStudent
          ?.levelName ||
        getLevelName(
          newLevel
        ),

      newBadges,
    };
  }

  throw new Error(
    "Workshop reward could not be processed because the student profile was updated concurrently."
  );
}