import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/services/firebaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workshopSnapshot = await adminDb
      .collection("workshops")
      .orderBy("title")
      .get();

    const workshops = workshopSnapshot.docs.map(
      (workshopDocument) => ({
        id: workshopDocument.id,
        ...workshopDocument.data(),
      })
    );

    return Response.json({
      success: true,
      workshops,
    });
  } catch (error) {
    console.error("Get workshops error:", error);

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

export async function POST(request) {
  try {
    const workshopData = await request.json();

    if (
      !workshopData.title?.trim() ||
      !workshopData.programArea?.trim() ||
      !workshopData.grade?.trim()
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Title, program area and grade are required.",
        },
        {
          status: 400,
        }
      );
    }

    const workshopReference = await adminDb
      .collection("workshops")
      .add({
        title: workshopData.title.trim(),
        programArea: workshopData.programArea.trim(),
        category:
          workshopData.category?.trim() || "General",
        grade: workshopData.grade.trim(),
        description:
          workshopData.description?.trim() || "",

        informationUrl:
          workshopData.informationUrl?.trim() || "",

        registrationUrl:
          workshopData.registrationUrl?.trim() ||
          "https://saitdigitalyouth.campbrainregistration.com/",

        learningMode:
          workshopData.learningMode || "in-person",

        startDate: workshopData.startDate || null,
        endDate: workshopData.endDate || null,
        time: workshopData.time?.trim() || "",
        location:
          workshopData.location?.trim() || "",

        capacity:
          workshopData.capacity === ""
            ? null
            : Number(workshopData.capacity),

        xpReward:
          Number(workshopData.xpReward) || 100,

        status: workshopData.status || "active",

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return Response.json(
      {
        success: true,
        message: "Workshop created successfully.",
        workshopId: workshopReference.id,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Create workshop error:", error);

    return Response.json(
      {
        success: false,
        message: "Workshop could not be created.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      ...workshopData
    } = await request.json();

    if (!id) {
      return Response.json(
        {
          success: false,
          message: "Workshop ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    await adminDb
      .collection("workshops")
      .doc(id)
      .update({
        title: workshopData.title.trim(),
        programArea: workshopData.programArea.trim(),
        category:
          workshopData.category?.trim() || "General",
        grade: workshopData.grade.trim(),
        description:
          workshopData.description?.trim() || "",

        informationUrl:
          workshopData.informationUrl?.trim() || "",

        registrationUrl:
          workshopData.registrationUrl?.trim() ||
          "https://saitdigitalyouth.campbrainregistration.com/",

        learningMode:
          workshopData.learningMode || "in-person",

        startDate: workshopData.startDate || null,
        endDate: workshopData.endDate || null,
        time: workshopData.time?.trim() || "",
        location:
          workshopData.location?.trim() || "",

        capacity:
          workshopData.capacity === ""
            ? null
            : Number(workshopData.capacity),

        xpReward:
          Number(workshopData.xpReward) || 100,

        status: workshopData.status || "active",

        updatedAt: FieldValue.serverTimestamp(),
      });

    return Response.json({
      success: true,
      message: "Workshop updated successfully.",
    });
  } catch (error) {
    console.error("Update workshop error:", error);

    return Response.json(
      {
        success: false,
        message: "Workshop could not be updated.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return Response.json(
        {
          success: false,
          message: "Workshop ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    await adminDb
      .collection("workshops")
      .doc(id)
      .delete();

    return Response.json({
      success: true,
      message: "Workshop deleted successfully.",
    });
  } catch (error) {
    console.error("Delete workshop error:", error);

    return Response.json(
      {
        success: false,
        message: "Workshop could not be deleted.",
      },
      {
        status: 500,
      }
    );
  }
}