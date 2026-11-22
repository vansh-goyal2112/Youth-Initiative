import { describeAdminAudit, withAdminAudit } from "@/services/adminAudit";
import crypto from "crypto";

import {
  adminAccessResponse,
  requireAdminPermission,
} from "@/services/adminAccess";

import {
  cosmosNow,
  createCosmosDocument,
  queryCosmosDocuments,
  readCosmosDocument,
} from "@/services/cosmosData";

import { generateManualAttendanceCode } from "@/services/attendanceManualCode.mjs";

export const runtime = "nodejs";

const ALLOWED_DURATIONS = [
  5,
  10,
  15,
  30,
];

async function createAttendanceCode(
  request
) {
  try {
    const admin =
      await requireAdminPermission(request, "attendance.manage");

    const {
      workshopId,
      catalogSessionId = null,
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

    const scheduled = Array.isArray(workshop.sessions) && workshop.sessions.length > 0
      ? workshop.sessions.find(item => item.id === catalogSessionId && item.status === "active")
      : null;
    if (Array.isArray(workshop.sessions) && workshop.sessions.length > 0 && !scheduled) {
      return Response.json({ success: false, message: "Choose an active scheduled date for the attendance QR." }, { status: 400 });
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

    // Keep this four-digit fallback unique among currently active sessions.
    // A later concurrency collision is rejected rather than selecting the wrong session.
    let manualCode = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const candidate = generateManualAttendanceCode();
      const clashes = await queryCosmosDocuments("attendanceSessions",
        "SELECT TOP 1 c.id FROM c WHERE c.manualCode = @code AND c.active = true AND c.expiresAt > @now",
        [{ name: "@code", value: candidate }, { name: "@now", value: cosmosNow() }]);
      if (clashes.length === 0) {
        manualCode = candidate;
        break;
      }
    }
    if (!manualCode) {
      return Response.json({ success: false, message: "Unable to allocate an attendance code. Try again." }, { status: 503 });
    }

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
        catalogSessionId: scheduled?.id || null,

        code:
          attendanceCode,
        manualCode,

        active:
          true,

        expiresAt,

        createdBy:
          admin.uid,

        createdAt,
      }
    );

    describeAdminAudit(request, { subject: workshop.title });
    return Response.json({
      success: true,

      attendanceSessionId,

      code:
        attendanceCode,
      manualCode,

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

export const POST = withAdminAudit(createAttendanceCode);
