import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import {
  readCosmosDocument,
} from "@/services/cosmosData";

import {
  getWorkshopEligibility,
} from "@/services/workshopEligibility";
import { ensureWorkshopXpAssigned } from "@/services/workshopXpMigration";
import { normalizeWorkshopGrades } from "@/utils/workshopGrades.mjs";

export const runtime = "nodejs";

export async function GET(
  request,
  context
) {
  try {
    const {
      student,
    } =
      await requireActiveStudent(
      request
    );

    const {
      id,
    } =
      await context.params;

    if (!student.schoolGrade) {
      return Response.json({ success: false, message: "Add your school grade in My Identity to explore workshops." }, { status: 409 });
    }

    if (
      typeof id !== "string" ||
      !id.trim()
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
      id.trim();

    const workshop = await ensureWorkshopXpAssigned(
      await readCosmosDocument("workshops", normalizedWorkshopId)
    );

    if (!workshop) {
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

    if (
      workshop.status !==
      "active"
    ) {
      return Response.json(
        {
          success: false,

          message:
            "This workshop is currently unavailable.",
        },
        {
          status: 404,
        }
      );
    }

    const normalizedWorkshop = normalizeWorkshopGrades(workshop);
    const eligibility = getWorkshopEligibility(
      normalizedWorkshop,
      student
    );

    if (eligibility.status === "ineligible") {
      return Response.json(
        {
          success: false,
          message: eligibility.reason,
        },
        {
          status: 403,
        }
      );
    }

    return Response.json({
      success: true,

      workshop: {
        id:
          workshop.id,

        ...normalizedWorkshop,
        eligibilityStatus: eligibility.status,
        eligibilityMessage: eligibility.reason,
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
      "Load workshop details error:",
      error?.message
    );

    return Response.json(
      {
        success: false,

        message:
          "Workshop details could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}