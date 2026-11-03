import crypto from "crypto";

import {
  adminAccessResponse,
  requireAdminPermission,
} from "@/services/adminAccess";

import {
  cosmosNow,
  createCosmosDocument,
  readCosmosDocument,
} from "@/services/cosmosData";

export const runtime = "nodejs";

const ALLOWED_DURATIONS = [
  5,
  10,
  15,
  30,
];

export async function POST(
  request
) {
  try {
    const admin =
      await requireAdminPermission(request, "attendance.manage");

    const {
      workshopId,
      durationMinutes = 15,
    } = await request.json();

    if (
      typeof workshopId !==
        "string" ||
      !workshopId.trim()
    ) {
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

    const normalizedWorkshopId =
      workshopId.trim();

    const duration =
      Number(
        durationMinutes
      );

    if (
      !ALLOWED_DURATIONS.includes(
        duration
      )
    ) {
      return Response.json(
        {
          success: false,

          message:
            "Attendance duration is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const workshop =
      await readCosmosDocument(
        "workshops",
        normalizedWorkshopId
      );

    if (
      !workshop
    ) {
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

    const attendanceCode =
      crypto
        .randomBytes(24)
        .toString("hex");

    const expiresAt =
      new Date(
        Date.now() +
          duration *
            60 *
            1000
      ).toISOString();

    const attendanceSessionId =
      crypto.randomUUID();

    const createdAt =
      cosmosNow();

    await createCosmosDocument(
      "attendanceSessions",
      {
        id:
          attendanceSessionId,

        workshopId:
          normalizedWorkshopId,

        code:
          attendanceCode,

        active:
          true,

        expiresAt,

        createdBy:
          admin.uid,

        createdAt,
      }
    );

    return Response.json({
      success: true,

      attendanceSessionId,

      code:
        attendanceCode,

      workshop,

      expiresAt,
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
      "Create attendance session error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Attendance QR could not be created.",
      },
      {
        status: 500,
      }
    );
  }
}