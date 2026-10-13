import {
  adminDb,
} from "@/services/firebaseAdmin";
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

    const registrationsSnapshot = await adminDb
      .collection("registrations")
      .where("studentId", "==", studentId)
      .where("status", "==", "completed")
      .get();

    const completedWorkshopResults = await Promise.all(
      registrationsSnapshot.docs.map((registrationDocument) => {
        const registration = registrationDocument.data();

        return adminDb
          .collection("workshops")
          .doc(registration.workshopId)
          .get();
      })
    );

    const completedWorkshops = completedWorkshopResults
      .filter((workshopSnapshot) => workshopSnapshot.exists)
      .map((workshopSnapshot) => ({
        id: workshopSnapshot.id,
        ...workshopSnapshot.data(),
      }));
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
