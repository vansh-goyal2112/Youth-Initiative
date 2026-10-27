import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import {
  queryCosmosDocuments,
} from "@/services/cosmosData";

import {
  getWorkshopEligibility,
} from "@/services/workshopEligibility";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const {
      student,
    } =
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
        .map((workshop) => {
          const eligibility = getWorkshopEligibility(
            workshop,
            student
          );

          return {
            id: workshop.id,
            ...workshop,
            eligibilityStatus: eligibility.status,
            eligibilityMessage: eligibility.reason,
          };
        })
        .filter((workshop) =>
          workshop.eligibilityStatus !== "ineligible"
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