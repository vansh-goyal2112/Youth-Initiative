import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import { getXpBalances } from "@/services/xpBalance.mjs";
import { getLevelInformation } from "@/services/levelProgress.mjs";
import { loadBadgeDefinitions } from "@/services/badgeCatalogue";
import { countMatchingSessions } from "@/services/customBadges.mjs";
import {
  queryCosmosDocuments,
  readCosmosDocument,
} from "@/services/cosmosData";

export const runtime = "nodejs";

function createQuestData({
  completedCount,
  categoryCount,
  technologyCount,
}) {
  return [
    {
      id: "first-steps",
      title: "First Steps",
      description:
        "Complete your first workshop",
      current: completedCount,
      target: 1,
      completed:
        completedCount >= 1,
      reward: 50,
      icon: "rocket",
    },

    {
      id: "skill-builder",
      title: "Skill Builder",
      description:
        "Complete 3 workshops",
      current: Math.min(
        completedCount,
        3
      ),
      target: 3,
      completed:
        completedCount >= 3,
      reward: 100,
      icon: "hammer",
    },

    {
      id: "curious-explorer",
      title: "Curious Explorer",
      description:
        "Explore 3 different skill areas",
      current: Math.min(
        categoryCount,
        3
      ),
      target: 3,
      completed:
        categoryCount >= 3,
      reward: 150,
      icon: "compass",
    },

    {
      id: "tech-journey",
      title: "Tech Journey",
      description:
        "Complete 3 Technology workshops",
      current: Math.min(
        technologyCount,
        3
      ),
      target: 3,
      completed:
        technologyCount >= 3,
      reward: 150,
      icon: "cpu",
    },

    {
      id: "workshop-champion",
      title: "Workshop Champion",
      description:
        "Complete 5 workshops",
      current: Math.min(
        completedCount,
        5
      ),
      target: 5,
      completed:
        completedCount >= 5,
      reward: 250,
      icon: "trophy",
    },
  ];
}

export async function GET(request) {
  try {
    const {
      uid: studentId,
      student,
    } =
      await requireActiveStudent(
        request
      );

    // requireActiveStudent already loaded and validated this Cosmos
    // profile. Reuse it instead of making a second database read.

    if (!student) {
      return Response.json(
        {
          success: false,

          message:
            "Student profile not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
      Load all completed
      registrations for the
      student.
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

    const completedWorkshops = [];
    const completedWithSnapshots = [];

    // Keep the original ordering, duplicate-registration behaviour and
    // error propagation. Bound concurrent Cosmos reads to avoid bursts.
    for (let offset = 0; offset < completedRegistrations.length; offset += 4) {
      const batch = completedRegistrations.slice(offset, offset + 4);
      const workshops = await Promise.all(batch.map(async registration =>
        registration.workshopSnapshot ||
        (registration.workshopId
          ? await readCosmosDocument("workshops", registration.workshopId)
          : null)
      ));
      for (let index = 0; index < workshops.length; index += 1) {
        const workshop = workshops[index];
        if (workshop) {
          completedWorkshops.push({ id: workshop.id, ...workshop });
        }
        completedWithSnapshots.push({ ...batch[index], workshopSnapshot: workshop });
      }
    }

    const categoryProgress = {};

    completedWorkshops.forEach(
      (workshop) => {
        const category =
          workshop.category ||
          "General";

        if (
          !categoryProgress[
            category
          ]
        ) {
          categoryProgress[
            category
          ] = {
            category,
            completed: 0,
            xp: 0,
          };
        }

        categoryProgress[
          category
        ].completed += 1;

        categoryProgress[
          category
        ].xp +=
          Number(
            workshop.xpReward ?? 100
          );
      }
    );

    const skillTracks =
      Object.values(
        categoryProgress
      ).map((track) => {
        const skillLevel =
          Math.floor(
            track.xp / 300
          ) + 1;

        const xpInsideLevel =
          track.xp % 300;

        return {
          ...track,

          level:
            skillLevel,

          nextLevelXp:
            skillLevel * 300,

          progressPercentage:
            Math.round(
              (xpInsideLevel /
                300) *
                100
            ),
        };
      });

    const technologyCount =
      categoryProgress
        .Technology
        ?.completed || 0;

    const quests =
      createQuestData({
        completedCount:
          completedWorkshops.length,

        categoryCount:
          Object.keys(
            categoryProgress
          ).length,

        technologyCount,
      });

    const definitions = await loadBadgeDefinitions();
    const badgeCatalog = definitions.map(definition => ({
      id: definition.badgeId,
      name: definition.name,
      description: definition.description || "",
      artworkUrl: definition.artworkUrl || "",
      rule: definition.rule,
      status: definition.status,
      target: Number(definition.rule?.minCount) || 1,
      current: countMatchingSessions(definition.rule, completedWithSnapshots),
    }));

    /*
      Load earned badge records.
    */

    const badgeDocuments =
      await queryCosmosDocuments(
        "studentBadges",
        `
          SELECT *
          FROM c
          WHERE c.studentId = @studentId
        `,
        [
          {
            name:
              "@studentId",

            value:
              studentId,
          },
        ]
      );

    const badges =
      badgeDocuments.map(
        (badge) => ({
          id:
            badge.id,

          ...badge,
        })
      );

    const totalXp =
      Number(
        student.totalXp
      ) || 0;

    const levelInformation =
      getLevelInformation(
        totalXp
      );
    const { currentXp } = getXpBalances(student);

    return Response.json({
      success: true,

      gamification: {
        totalXp,
        currentXp,

        activeQuestId: student.activeQuestId || null,

        level:
          levelInformation.level,

        rank:
          levelInformation.name,

        nextLevelXp:
          levelInformation.nextXp,

        levelMinimumXp:
          levelInformation.minimumXp,

        progressPercentage:
          levelInformation.progressPercentage,

        completedWorkshops:
          completedWorkshops.length,

        categoryCount:
          Object.keys(
            categoryProgress
          ).length,

        badgeCount:
          badges.length,
        badgeCatalog,
        earnedBadgeIds: student.badges,

        skillTracks,

        quests,

        badges,
      },
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
      "Gamification API error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          error.message ===
          "UNAUTHORIZED"
            ? "Please log in."
            : "Gamification progress could not be loaded.",
      },
      {
        status:
          error.message ===
          "UNAUTHORIZED"
            ? 401
            : 500,
      }
    );
  }
}