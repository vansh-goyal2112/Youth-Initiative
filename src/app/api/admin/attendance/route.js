import crypto from "crypto";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import { adminDb } from "@/services/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const {
      workshopId,
      durationMinutes = 15,
    } = await request.json();

    if (!workshopId) {
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

    const workshopSnapshot =
      await adminDb
        .collection("workshops")
        .doc(workshopId)
        .get();

    if (!workshopSnapshot.exists) {
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

    const attendanceCode =
      crypto
        .randomBytes(24)
        .toString("hex");

    const expiresAt =
      Timestamp.fromDate(
        new Date(
          Date.now() +
            durationMinutes *
              60 *
              1000
        )
      );

    const attendanceReference =
      adminDb
        .collection(
          "attendanceSessions"
        )
        .doc();

    await attendanceReference.set({
      workshopId,

      code:
        attendanceCode,

      active: true,

      expiresAt,

      createdAt:
        FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,

      attendanceSessionId:
        attendanceReference.id,

      code:
        attendanceCode,

      workshop:
        workshopSnapshot.data(),

      expiresAt:
        expiresAt
          .toDate()
          .toISOString(),
    });
  } catch (error) {
    console.error(
      "Create attendance session error:",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Attendance QR could not be created.",
      },
      {
        status: 500,
      }
    );
  }
}