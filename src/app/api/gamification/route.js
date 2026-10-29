import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import {
  queryCosmosDocuments,
  readCosmosDocument,
} from "@/services/cosmosData";

export const runtime = "nodejs";

function getLevelInformation(totalXp) {
  const levels = [
    {
      level: 1,
      name: "New Explorer",
      minimumXp: 0,
      nextXp: 100,
    },

    {
      level: 2,
      name: "Skill Starter",
      minimumXp: 100,
      nextXp: 250,
    },

    {
      level: 3,
      name: "Future Creator",
      minimumXp: 250,
      nextXp: 450,
    },

    {
      level: 4,
      name: "Innovation Builder",
      minimumXp: 450,
      nextXp: 700,
    },

    {
      level: 5,
      name: "Pathway Explorer",
      minimumXp: 700,
      nextXp: 1000,
    },

    {
      level: 6,
      name: "Youth Champion",
      minimumXp: 1000,
      nextXp: null,
    },
  ];

  let currentLevel =
    levels[0];

  for (const level of levels) {
    if (
      totalXp >= level.minimumXp
    ) {
      currentLevel = level;
    }
  }

  let progressPercentage = 100;

  if (currentLevel.nextXp) {
    const levelRange =
      currentLevel.nextXp -
      currentLevel.minimumXp;

    const levelProgress =
      totalXp -
      currentLevel.minimumXp;

    progressPercentage = Math.min(
      100,
      Math.round(
        (levelProgress /
          levelRange) *
          100
      )
    );
  }

  return {
    ...currentLevel,
    progressPercentage,
  };
}

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

    // Keep the original ordering, duplicate-registration behaviour and
    // error propagation. Bound concurrent Cosmos reads to avoid bursts.
    const workshopIds = completedRegistrations
      .map((registration) => registration.workshopId)
      .filter(Boolean);

    for (let offset = 0; offset < workshopIds.length; offset += 4) {
      const batch = workshopIds.slice(offset, offset + 4);
      const workshops = await Promise.all(
        batch.map((id) => readCosmosDocument("workshops", id))
      );
      for (const workshop of workshops) {
        if (workshop) {
          completedWorkshops.push({ id: workshop.id, ...workshop });
        }
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
            workshop.xpReward
          ) || 100;
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

    return Response.json({
      success: true,

      gamification: {
        totalXp,

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