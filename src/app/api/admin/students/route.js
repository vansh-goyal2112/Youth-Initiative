import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

export const runtime = "nodejs";

async function verifyAdmin(request) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization?.startsWith(
      "Bearer "
    )
  ) {
    throw new Error(
      "UNAUTHORIZED"
    );
  }

  const token =
    authorization.replace(
      "Bearer ",
      ""
    );

  const decoded =
    await adminAuth.verifyIdToken(
      token
    );

  const adminSnapshot =
    await adminDb
      .collection("admins")
      .doc(decoded.uid)
      .get();

  if (
    !adminSnapshot.exists ||
    adminSnapshot.data().role !==
      "admin" ||
    adminSnapshot.data().status !==
      "active"
  ) {
    throw new Error(
      "FORBIDDEN"
    );
  }
}


export async function GET(request) {
  try {
    await verifyAdmin(request);

    const snapshot =
      await adminDb
        .collection("students")
        .get();

    const students =
      snapshot.docs
        .map((document) => ({
          id: document.id,
          ...document.data(),
        }))
        .sort((a, b) =>
          `${a.firstName || ""}`
            .localeCompare(
              b.firstName || ""
            )
        );

    return Response.json({
      success: true,
      students,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message:
          "Students could not be loaded.",
      },
      {
        status:
          error.message ===
          "UNAUTHORIZED"
            ? 401
            : error.message ===
                "FORBIDDEN"
              ? 403
              : 500,
      }
    );
  }
}


export async function PUT(request) {
  try {
    await verifyAdmin(request);

    const {
      id,
      firstName,
      lastName,
      contactEmail,
      learningMode,
      interests,
      accountStatus,
    } = await request.json();

    if (!id) {
      return Response.json(
        {
          success: false,
          message:
            "Student ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const studentReference =
      adminDb
        .collection("students")
        .doc(id);

    const studentSnapshot =
      await studentReference.get();

    if (!studentSnapshot.exists) {
      return Response.json(
        {
          success: false,
          message:
            "Student not found.",
        },
        {
          status: 404,
        }
      );
    }

    await studentReference.update({
      firstName:
        firstName?.trim() || "",

      lastName:
        lastName?.trim() || "",

      fullName:
        `${firstName || ""} ${lastName || ""}`
          .trim(),

      contactEmail:
        contactEmail?.trim() ||
        "",

      learningMode:
        learningMode || null,

      interests:
        Array.isArray(interests)
          ? interests
          : [],

      accountStatus:
        accountStatus ||
        "active",

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,
      message:
        "Student updated successfully.",
    });
  } catch (error) {
    console.error(
      "Admin update student error:",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Student could not be updated.",
      },
      {
        status: 500,
      }
    );
  }
}


export async function DELETE(request) {
  try {
    await verifyAdmin(request);

    const {
      id,
    } = await request.json();

    if (!id) {
      return Response.json(
        {
          success: false,
          message:
            "Student ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    await adminAuth.updateUser(
      id,
      {
        disabled: true,
      }
    );

    await adminDb
      .collection("students")
      .doc(id)
      .update({
        accountStatus:
          "inactive",

        updatedAt:
          FieldValue.serverTimestamp(),
      });

    return Response.json({
      success: true,
      message:
        "Student account deactivated.",
    });
  } catch (error) {
    console.error(
      "Admin deactivate student error:",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Student could not be deactivated.",
      },
      {
        status: 500,
      }
    );
  }
}