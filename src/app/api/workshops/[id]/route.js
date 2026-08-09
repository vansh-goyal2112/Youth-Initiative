import { adminDb } from "@/services/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    const workshopSnapshot = await adminDb
      .collection("workshops")
      .doc(id)
      .get();

    if (!workshopSnapshot.exists) {
      return Response.json(
        {
          success: false,
          message: "Workshop not found.",
        },
        {
          status: 404,
        }
      );
    }

    const workshop = {
      id: workshopSnapshot.id,
      ...workshopSnapshot.data(),
    };

    if (workshop.status !== "active") {
      return Response.json(
        {
          success: false,
          message: "This workshop is currently unavailable.",
        },
        {
          status: 404,
        }
      );
    }

    return Response.json({
      success: true,
      workshop,
    });
  } catch (error) {
    console.error("Load workshop details error:", error);

    return Response.json(
      {
        success: false,
        message: "Workshop details could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}