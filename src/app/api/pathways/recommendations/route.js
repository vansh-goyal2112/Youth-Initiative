import {
  queryCosmosDocuments,
  readCosmosDocument,
} from "@/services/cosmosData";
import {
  getActiveSaitPrograms,
} from "@/services/saitProgramService";
import {
  recommendSaitPrograms,
} from "@/services/saitProgramRecommendations";
import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { uid: studentId, student } =
      await requireActiveStudent(request);

    // Fetch independent program and registration data together.
    const [registrationDocuments, programs] = await Promise.all([
      queryCosmosDocuments(
            "registrations",
            `
              SELECT *
              FROM c
              WHERE c.studentId = @studentId AND c.status = @status
            `,
            [
              {
                name: "@studentId",
                value: studentId,
              },
              {
                name: "@status",
                value: "completed",
              },
            ]
          );,
      getActiveSaitPrograms(),
    ]);

    const completedWorkshopResults = await Promise.all(
      registrationDocuments.map(async (registration) => {
        if (!registration.workshopId) {
          return null;
        }

        return readCosmosDocument(
          "workshops",
          registration.workshopId
        );
      })
    );

    const completedWorkshops = completedWorkshopResults.filter(Boolean);
    const recommendations = recommendSaitPrograms({
      student,
      completedWorkshops,
      programs,
    });

    return Response.json({
      success: true,
      recommendations,
    });
  } catch (error) {
    const accessResponse = studentAccessResponse(error);

    if (accessResponse) {
      return accessResponse;
    }

    console.error("SAIT program recommendations error:", error);

    return Response.json(
      {
        success: false,
        message: "SAIT program recommendations could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}
