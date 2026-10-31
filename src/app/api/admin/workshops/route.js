import { assignWorkshopImage, workshopImageUsage } from "@/utils/workshopImageAssignment.mjs";
import crypto from "crypto";

import {
  adminAccessResponse,
  requireAdminPermission,
} from "@/services/adminAccess";

import {
  cosmosNow,
  createCosmosDocument,
  deleteCosmosDocument,
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
    !workshop?.title?.trim() ||
    !workshop?.programArea?.trim() ||
    !workshop?.grade?.trim()
  ) {
    return "Title, program area and grade are required.";
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

  return null;
}

function buildWorkshopData(
  workshop
) {
  const capacity =
    workshop.capacity === "" ||
    workshop.capacity === null ||
    workshop.capacity === undefined
      ? null
      : Number(
          workshop.capacity
        );

  const xpReward =
    Number(
      workshop.xpReward
    );

  return {
    title:
      workshop.title.trim(),

    programArea:
      workshop.programArea.trim(),

    category:
      workshop.category?.trim() ||
      "General",

    grade:
      workshop.grade.trim(),

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

    xpReward:
      Number.isFinite(xpReward) &&
      xpReward >= 0
        ? xpReward
        : 100,

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
          ORDER BY c.title
        `
      );

    return Response.json({
      success: true,
      workshops,
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

    const existingImages = await queryCosmosDocuments("workshops", "SELECT c.id, c.image, c.imageAssetId FROM c");
    const imageAssignment = assignWorkshopImage(
      { ...workshopData, id: workshopId }, workshopImageUsage(existingImages)
    );
    await createCosmosDocument(
      "workshops",
      {
        ...imageAssignment,
        id:
          workshopId,

        ...buildWorkshopData(
          workshopData
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

    await replaceCosmosDocument(
      "workshops",
      existingWorkshop,
      {
        ...buildWorkshopData(
          workshopData
        ),
        // Reassign only automatically chosen images when topic changes.
        ...(existingWorkshop.imageStatus === "custom" ||
          (existingWorkshop.image && !existingWorkshop.imageAssetId)
          ? {}
          : (existingWorkshop.title !== workshopData.title ||
             existingWorkshop.programArea !== workshopData.programArea ||
             existingWorkshop.category !== (workshopData.category || "General"))
            ? assignWorkshopImage(
                { ...workshopData, id },
                workshopImageUsage(await queryCosmosDocuments("workshops",
                  "SELECT c.id, c.image, c.imageAssetId FROM c"), id)
              )
            : {}),

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

    // Registrations, QR attendance, and XP records reference the workshop ID.
    // Deleting a referenced workshop would orphan historical student activity.
    // Instead, set its status to inactive in Edit Workshop to archive it.
    const dependentContainers = [
      ["registrations", "student registrations"],
      ["attendanceSessions", "attendance sessions"],
      ["xpTransactions", "student XP transactions"],
    ];
    for (const [container, description] of dependentContainers) {
      const dependencies = await queryCosmosDocuments(
        container,
        "SELECT TOP 1 c.id FROM c WHERE c.workshopId = @id",
        [{ name: "@id", value: id }]
      );
      if (dependencies.length) {
        return Response.json(
          {
            success: false,
            code: "WORKSHOP_HAS_HISTORY",
            message: `This workshop has ${description}. Set its status to Inactive instead of deleting it, so students keep their attendance and XP history.`,
          },
          { status: 409 }
        );
      }
    }

    await deleteCosmosDocument(
      "workshops",
      id
    );

    return Response.json({
      success: true,

      message:
        "Workshop deleted successfully.",
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