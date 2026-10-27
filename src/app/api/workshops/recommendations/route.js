import {
  queryCosmosDocuments,
  readCosmosDocument,
} from "@/services/cosmosData";
import {
  getCompletedStudentWorkshops,
} from "@/services/studentJourney";
import {
  recommendWorkshops,
} from "@/services/workshopRecommendations";
import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { uid: studentId, student } =
      await requireActiveStudent(request);

    const completedWorkshops = await getCompletedStudentWorkshops(
      studentId,
      {
        queryDocuments: queryCosmosDocuments,
        readDocument: readCosmosDocument,
      }
    );

    const registrations = await queryCosmosDocuments(
      "registrations",
      "SELECT c.workshopId FROM c WHERE c.studentId = @studentId",
      [{ name: "@studentId", value: studentId }]
    );

    const workshops = await queryCosmosDocuments(
      "workshops",
      "SELECT * FROM c WHERE c.status = @status",
      [{ name: "@status", value: "active" }]
    );

    const recommendations = recommendWorkshops({
      student,
      completedWorkshops,
      registeredWorkshopIds: registrations
        .map((registration) => registration.workshopId)
        .filter(Boolean),
      workshops,
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

    console.error("Workshop recommendations error:", error?.message);

    return Response.json(
      {
        success: false,
        message: "Workshop recommendations could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}
