import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import {
  queryCosmosDocuments,
} from "@/services/cosmosData";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await requireActiveStudent(
      request
    );

    const workshopDocuments =
      await queryCosmosDocuments(
        "workshops",
        `
          SELECT *
          FROM c
          WHERE c.status = @status
        `,
        [
          {
            name:
              "@status",

            value:
              "active",
          },
        ]
      );

    const workshops =
      workshopDocuments
        .map(
          (
            workshop
          ) => ({
            id:
              workshop.id,

            ...workshop,
          })
        )
        .sort(
          (
            firstWorkshop,
            secondWorkshop
          ) =>
            firstWorkshop.title.localeCompare(
              secondWorkshop.title
            )
        );

    return Response.json({
      success: true,
      workshops,
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
      "Load workshops error:",
      error?.message
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