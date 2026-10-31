import crypto from "crypto";

import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import {
  cosmosNow,
  createCosmosDocument,
  queryCosmosDocuments,
  readCosmosDocument,
} from "@/services/cosmosData";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const {
      uid,
    } =
      await requireActiveStudent(
        request
      );

    const registrationDocuments =
      await queryCosmosDocuments(
        "registrations",
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
              uid,
          },
        ]
      );

    const registrations =
      await Promise.all(
        registrationDocuments.map(
          async (
            registration
          ) => {
            const workshop = registration.status === "completed" && registration.workshopSnapshot
              ? registration.workshopSnapshot
              : registration.workshopId
                ? await readCosmosDocument("workshops", registration.workshopId)
                : null;

            return {
              id:
                registration.id,

              ...registration,

              workshop:
                workshop
                  ? {
                      id:
                        workshop.id,

                      ...workshop,
                    }
                  : null,
            };
          }
        )
      );

    return Response.json({
      success:
        true,

      registrations,
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
      "Get registrations error:",
      error
    );

    const status =
      error.message ===
      "UNAUTHORIZED"
        ? 401
        : error.message ===
            "STUDENT_NOT_FOUND"
          ? 404
          : 500;

    return Response.json(
      {
        success:
          false,

        message:
          status === 401
            ? "You must be logged in."
            : "Registrations could not be loaded.",
      },
      {
        status,
      }
    );
  }
}

export async function POST(request) {
  try {
    const {
      uid,
    } =
      await requireActiveStudent(
        request
      );

    const {
      workshopId,
    } =
      await request.json();

    if (!workshopId) {
      return Response.json(
        {
          success:
            false,

          message:
            "Workshop ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const workshop =
      await readCosmosDocument(
        "workshops",
        workshopId
      );

    if (
      !workshop ||
      workshop.status !==
        "active"
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "This workshop is unavailable.",
        },
        {
          status:
            404,
        }
      );
    }

    const existingRegistrations =
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
              uid,
          },
          {
            name:
              "@workshopId",

            value:
              workshopId,
          },
        ]
      );

    if (
      existingRegistrations.length >
      0
    ) {
      const existingRegistration =
        existingRegistrations[0];

      return Response.json(
        {
          success:
            true,

          alreadyRegistered:
            true,

          registrationId:
            existingRegistration.id,

          message:
            "This workshop is already in your registered workshops.",
        },
        {
          status:
            200,
        }
      );
    }

    const registrationId =
      crypto.randomUUID();

    const registeredAt =
      cosmosNow();

    await createCosmosDocument(
      "registrations",
      {
        id:
          registrationId,

        studentId:
          uid,

        workshopId,

        status:
          "upcoming",

        externalRegistrationConfirmed:
          true,

        attendanceStatus:
          "pending",

        attendanceSessionId:
          null,

        attendedAt:
          null,

        completedAt:
          null,

        registrationXpAwarded:
          false,

        completionXpAwarded:
          false,

        registeredAt,

        createdAt:
          registeredAt,

        updatedAt:
          registeredAt,
      }
    );

    return Response.json(
      {
        success:
          true,

        alreadyRegistered:
          false,

        registrationId,

        message:
          "Workshop added to your upcoming workshops.",
      },
      {
        status:
          201,
      }
    );
  } catch (error) {
    const accessResponse =
      studentAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Create registration error:",
      error
    );

    const status =
      error.message ===
      "UNAUTHORIZED"
        ? 401
        : error.message ===
            "STUDENT_NOT_FOUND"
          ? 404
          : 500;

    return Response.json(
      {
        success:
          false,

        message:
          status === 401
            ? "Please log in before registering."
            : "The registration could not be saved.",
      },
      {
        status,
      }
    );
  }
}