import { workshopCompletionSnapshot } from "@/services/workshopHistory.mjs";
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
          WHERE NOT IS_DEFINED(c.status) OR c.status != "deleted"
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

    // First persist independent historical records. If any write fails,
    // stop without deleting the catalogue record.
    const completed = await queryCosmosDocuments(
      "registrations",
      "SELECT * FROM c WHERE c.workshopId = @workshopId AND c.status = 'completed'",
      [{ name: "@workshopId", value: id }]
    );
    for (const registration of completed) {
      const transaction = await readCosmosDocument(
        "xpTransactions", `${registration.studentId}_${id}`
      );
      if (!transaction || transaction.status !== "completed" || registration.completionXpAwarded !== true) {
        return Response.json({ success: false, code: "WORKSHOP_REWARD_PENDING", message: "Finalize pending student XP awards before permanently deleting this workshop." }, { status: 409 });
      }
      const snapshot = registration.workshopSnapshot ||
        workshopCompletionSnapshot(existingWorkshop, registration, transaction);
      if (!registration.workshopSnapshot) {
        await replaceCosmosDocument("registrations", registration, {
          workshopSnapshot: snapshot, updatedAt: cosmosNow(),
        });
      }
    }
    // Uncompleted registrations / QR sessions must not be left usable.
    const pending = await queryCosmosDocuments(
      "registrations",
      "SELECT * FROM c WHERE c.workshopId = @workshopId AND c.status != 'completed'",
      [{ name: "@workshopId", value: id }]
    );
    for (const registration of pending) {
      if (registration.status !== "cancelled") {
        await replaceCosmosDocument("registrations", registration, {
          status: "cancelled", cancelledReason: "workshop_discontinued",
          updatedAt: cosmosNow(),
        });
      }
    }
    const sessions = await queryCosmosDocuments(
      "attendanceSessions",
      "SELECT * FROM c WHERE c.workshopId = @workshopId AND c.active = true",
      [{ name: "@workshopId", value: id }]
    );
    for (const session of sessions) {
      await replaceCosmosDocument("attendanceSessions", session, {
        active: false, updatedAt: cosmosNow(),
      });
    }
    // Disallow physical deletion if any completed record lacks its snapshot.
    const verify = await queryCosmosDocuments(
      "registrations",
      "SELECT c.id, c.workshopSnapshot FROM c WHERE c.workshopId = @workshopId AND c.status = 'completed'",
      [{ name: "@workshopId", value: id }]
    );
    if (verify.some(row => !row.workshopSnapshot?.id)) {
      return Response.json({ success: false,
        message: "Historical completion preservation did not finish. Workshop was not deleted."
      }, { status: 409 });
    }
    await deleteCosmosDocument("workshops", id);

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