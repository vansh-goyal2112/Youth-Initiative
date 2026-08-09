import crypto from "crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

export const runtime = "nodejs";

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function validatePassword(password) {
  if (
    !password ||
    password.length < 10
  ) {
    return "Password must contain at least 10 characters.";
  }

  if (
    password.length > 64
  ) {
    return "Password cannot exceed 64 characters.";
  }

  if (
    !/[A-Z]/.test(password)
  ) {
    return "Password must contain an uppercase letter.";
  }

  if (
    !/[a-z]/.test(password)
  ) {
    return "Password must contain a lowercase letter.";
  }

  if (
    !/[0-9]/.test(password)
  ) {
    return "Password must contain a number.";
  }

  if (
    !/[^A-Za-z0-9]/.test(
      password
    )
  ) {
    return "Password must contain a special character.";
  }

  return null;
}

export async function POST(request) {
  try {
    const {
      requestId,
      token,
      password,
      confirmPassword,
    } = await request.json();

    if (
      !requestId ||
      !token
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Password reset information is missing.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      password !==
      confirmPassword
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Passwords do not match.",
        },
        {
          status: 400,
        }
      );
    }

    const passwordError =
      validatePassword(
        password
      );

    if (passwordError) {
      return Response.json(
        {
          success: false,
          message:
            passwordError,
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
            "This reset request has already been used.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      !reset.parentVerified
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Parent verification is required.",
        },
        {
          status: 403,
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
            "This reset link has expired.",
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
            "Password reset token is invalid.",
        },
        {
          status: 401,
        }
      );
    }

    await adminAuth.updateUser(
      reset.studentId,
      {
        password,
      }
    );

    await resetReference.update({
      status:
        "completed",

      usedAt:
        FieldValue.serverTimestamp(),

      tokenHash: null,

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,

      message:
        "Password updated successfully.",
    });
  } catch (error) {
    console.error(
      "Complete password reset error:",
      error
    );

    return Response.json(
      {
        success: false,

        message:
          "Password could not be updated.",
      },
      {
        status: 500,
      }
    );
  }
}