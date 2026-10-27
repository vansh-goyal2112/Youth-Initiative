import {
  queryCosmosDocuments,
  readCosmosDocument,
} from "@/services/cosmosData";
import {
  getCompletedStudentWorkshops,
} from "@/services/studentJourney";
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

    const completedWorkshops = await getCompletedStudentWorkshops(
      studentId,
      {
        queryDocuments: queryCosmosDocuments,
        readDocument: readCosmosDocument,
      }
    );
    const programs = await getActiveSaitPrograms();
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
