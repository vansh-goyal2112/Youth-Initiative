import crypto from "crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/services/firebaseAdmin";

export const runtime = "nodejs";

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function POST(request) {
  try {
    const {
      requestId,
      token,
      approve,
    } = await request.json();

    if (
      !requestId ||
      !token
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Verification link is incomplete.",
        },
        {
          status: 400,
        }
      );
    }

    const resetReference =
      adminDb
        .collection(
          "passwordResetRequests"
        )
        .doc(requestId);

    const resetSnapshot =
      await resetReference.get();

    if (!resetSnapshot.exists) {
      return Response.json(
        {
          success: false,
          message:
            "Password reset request was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const reset =
      resetSnapshot.data();

    if (
      reset.status ===
      "completed"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "This reset link has already been used.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      reset.expiresAt
        .toDate()
        .getTime() <
      Date.now()
    ) {
      return Response.json(
        {
          success: false,
          message:
            "This verification link has expired.",
        },
        {
          status: 410,
        }
      );
    }

    if (
      hashToken(token) !==
      reset.tokenHash
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Verification token is invalid.",
        },
        {
          status: 401,
        }
      );
    }

    if (approve) {
      await resetReference.update({
        parentVerified: true,

        status:
          "verified",

        verifiedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });
    }

    return Response.json({
      success: true,

      verified:
        approve
          ? true
          : reset.parentVerified,

      youthId:
        reset.youthId,
    });
  } catch (error) {
    console.error(
      "Parent verification error:",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Verification could not be completed.",
      },
      {
        status: 500,
      }
    );
  }
}