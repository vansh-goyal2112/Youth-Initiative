import { adminDb } from "@/services/firebaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workshopsSnapshot = await adminDb
      .collection("workshops")
      .where("status", "==", "active")
      .get();

    const workshops = workshopsSnapshot.docs
      .map((workshopDocument) => ({
        id: workshopDocument.id,
        ...workshopDocument.data(),
      }))
      .sort((firstWorkshop, secondWorkshop) =>
        firstWorkshop.title.localeCompare(secondWorkshop.title)
      );

    return Response.json({
      success: true,
      workshops,
    });
  } catch (error) {
    console.error("Load public workshops error:", error);

    return Response.json(
      {
        success: false,
        message: "Workshops could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}