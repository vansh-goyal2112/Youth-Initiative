import { retireWorkshopPermanently } from "@/services/workshopRetirement";
import { WORKSHOP_IMAGE_PLACEHOLDER } from "@/utils/workshopImageAssignment.mjs";
import crypto from "crypto";
import { automaticWorkshopXp } from "@/services/workshopXpAssignment.mjs";
import { ensureWorkshopCatalogueXp } from "@/services/workshopXpMigration";
import { formatWorkshopGradeRange } from "@/utils/workshopGrades.mjs";
import { normalizeWorkshopOption, normalizeWorkshopTags, workshopCategories, workshopEditorGradeBounds, workshopProgramAreas } from "@/utils/workshopCatalogueFields.mjs";

import {
  adminAccessResponse,
  requireAdminPermission,
} from "@/services/adminAccess";

import {
  cosmosNow,
  createCosmosDocument,
  queryCosmosDocuments,
  readCosmosDocument,
  replaceCosmosDocument,
} from "@/services/cosmosData";

export const runtime = "nodejs";

const VALID_LEARNING_MODES = [
  "in-person",
  "online",
  "both",
];

const VALID_STATUSES = [
  "active",
  "inactive",
];

function validateWorkshop(
  workshop
) {
  if (
    typeof workshop?.title !== "string" || !workshop.title.trim() ||
    typeof workshop?.programArea !== "string" || !workshop.programArea.trim()
  ) {
    return "Title, program area and grade are required.";
  }

  if (!workshopEditorGradeBounds(workshop)) {
    return "Choose a minimum and maximum grade from Kindergarten to Grade 12.";
  }

  if (workshop.interestTags !== undefined &&
      (!Array.isArray(workshop.interestTags) ||
       workshop.interestTags.some(tag => !normalizeWorkshopTags([tag]).length))) {
    return "Choose interests from the provided options.";
  }

  if (
    workshop.learningMode &&
    !VALID_LEARNING_MODES.includes(
      workshop.learningMode
    )
  ) {
    return "Learning mode is invalid.";
  }

  if (
    workshop.status &&
    !VALID_STATUSES.includes(
      workshop.status
    )
  ) {
    return "Workshop status is invalid.";
  }

  if (workshop.xpReward !== undefined && workshop.xpReward !== null && workshop.xpReward !== "") {
    const xp = Number(workshop.xpReward);
    if (!Number.isSafeInteger(xp) || xp < 1 || xp > 100000) {
      return "XP reward must be a positive whole number (1–100000).";
    }
  }

  return null;
}

function buildWorkshopData(
  workshop, workshopId
) {
  const gradeBounds = workshopEditorGradeBounds(workshop);
  const capacity =
    workshop.capacity === "" ||
    workshop.capacity === null ||
    workshop.capacity === undefined
      ? null
      : Number(
          workshop.capacity
        );

  const explicitlySetXp = workshop.xpReward !== "" &&
    workshop.xpReward !== null && workshop.xpReward !== undefined;
  const xpReward = explicitlySetXp ? Number(workshop.xpReward) : automaticWorkshopXp(workshopId);

  return {
    title:
      workshop.title.trim(),

    programArea:
      normalizeWorkshopOption(workshop.programArea, workshopProgramAreas),

    category:
      normalizeWorkshopOption(workshop.category, workshopCategories) ||
      "General",

    ...(workshop.interestTags !== undefined ? { interestTags: normalizeWorkshopTags(workshop.interestTags) } : {}),

    grade:
      formatWorkshopGradeRange(gradeBounds),

    minGrade: gradeBounds.minGrade,
    maxGrade: gradeBounds.maxGrade,

    description:
      workshop.description?.trim() ||
      "",

    informationUrl:
      workshop.informationUrl?.trim() ||
      "",

    registrationUrl:
      workshop.registrationUrl?.trim() ||
      "https://saitdigitalyouth.campbrainregistration.com/",

    learningMode:
      workshop.learningMode ||
      "in-person",

    startDate:
      workshop.startDate ||
      null,

    endDate:
      workshop.endDate ||
      null,

    time:
      workshop.time?.trim() ||
      "",

    location:
      workshop.location?.trim() ||
      "",

    capacity:
      Number.isFinite(capacity)
        ? capacity
        : null,

    xpReward: explicitlySetXp ? xpReward : automaticWorkshopXp(workshopId),
    xpRewardSource: explicitlySetXp ? "manual" : "automatic",

    status:
      workshop.status ||
      "active",
  };
}

export async function GET(
  request
) {
  try {
    await requireAdminPermission(request, "workshops.view");

    const workshops =
      await queryCosmosDocuments(
        "workshops",
        `
          SELECT *
          FROM c
          WHERE NOT IS_DEFINED(c.status) OR c.status != "deleted"
          ORDER BY c.title
        `
      );

    return Response.json({
      success: true,
      workshops: await ensureWorkshopCatalogueXp(workshops),
    });
  } catch (error) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Get workshops error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Workshops could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request
) {
  try {
    const admin =
      await requireAdminPermission(request, "workshops.create");

    const workshopData =
      await request.json();

    const validationError =
      validateWorkshop(
        workshopData
      );

    if (validationError) {
      return Response.json(
        {
          success: false,

          message:
            validationError,
        },
        {
          status: 400,
        }
      );
    }

    const workshopId =
      crypto.randomUUID();

    const createdAt =
      cosmosNow();

    await createCosmosDocument(
      "workshops",
      {
        ...WORKSHOP_IMAGE_PLACEHOLDER,
        id:
          workshopId,

        ...buildWorkshopData(
          workshopData, workshopId
        ),

        createdBy:
          admin.uid,

        createdAt,

        updatedAt:
          createdAt,
      }
    );

    return Response.json(
      {
        success: true,

        message:
          "Workshop created successfully.",

        workshopId,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Create workshop error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Workshop could not be created.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(
  request
) {
  try {
    const admin =
      await requireAdminPermission(request, "workshops.edit");

    const {
      id,
      ...workshopData
    } =
      await request.json();

    if (!id) {
      return Response.json(
        {
          success: false,

          message:
            "Workshop ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const validationError =
      validateWorkshop(
        workshopData
      );

    if (validationError) {
      return Response.json(
        {
          success: false,

          message:
            validationError,
        },
        {
          status: 400,
        }
      );
    }

    const existingWorkshop =
      await readCosmosDocument(
        "workshops",
        id
      );

    if (!existingWorkshop || existingWorkshop.status === "deleted") {
      return Response.json(
        {
          success: false,

          message:
            "Workshop not found.",
        },
        {
          status: 404,
        }
      );
    }

    await replaceCosmosDocument(
      "workshops",
      existingWorkshop,
      {
        ...buildWorkshopData(
          workshopData, id
        ),
        updatedBy:
          admin.uid,

        updatedAt:
          cosmosNow(),
      }
    );

    return Response.json({
      success: true,

      message:
        "Workshop updated successfully.",
    });
  } catch (error) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Update workshop error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Workshop could not be updated.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  request
) {
  try {
    await requireAdminPermission(request, "workshops.delete");

    const {
      id,
    } =
      await request.json();

    if (!id) {
      return Response.json(
        {
          success: false,

          message:
            "Workshop ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const existingWorkshop =
      await readCosmosDocument(
        "workshops",
        id
      );

    if (!existingWorkshop) {
      return Response.json(
        {
          success: false,

          message:
            "Workshop not found.",
        },
        {
          status: 404,
        }
      );
    }

    await retireWorkshopPermanently(existingWorkshop);

    return Response.json({
      success: true,

      message:
        "Workshop permanently removed from the catalogue database. Historical student achievements are preserved.",
    });
  } catch (error) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Delete workshop error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Workshop could not be deleted.",
      },
      {
        status: 500,
      }
    );
  }
}