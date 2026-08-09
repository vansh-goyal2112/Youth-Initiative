import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const authorization =
      request.headers.get("authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return Response.json(
        {
          success: false,
          message: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const token = authorization.replace(
      "Bearer ",
      ""
    );

    const decodedToken =
      await adminAuth.verifyIdToken(token);

    const adminSnapshot =
      await adminDb
        .collection("admins")
        .doc(decodedToken.uid)
        .get();

    if (!adminSnapshot.exists) {
      return Response.json(
        {
          success: false,
          message:
            "This account does not have administrator access.",
        },
        {
          status: 403,
        }
      );
    }

    const adminData =
      adminSnapshot.data();

    const adminStatus =
      String(adminData.status || "")
        .trim()
        .toLowerCase();

    const adminRole =
      String(adminData.role || "")
        .trim()
        .toLowerCase();

    console.log("Admin data:", {
      uid: decodedToken.uid,
      status: adminData.status,
      role: adminData.role,
      normalizedStatus: adminStatus,
      normalizedRole: adminRole,
    });

    if (
      adminData.status !== "active" ||
      adminData.role !== "admin"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Administrator access is inactive.",
        },
        {
          status: 403,
        }
      );
    }

    return Response.json({
      success: true,

      admin: {
        uid: decodedToken.uid,
        email: adminData.email,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        role: adminData.role,
      },
    });
  } catch (error) {
    console.error(
      "Admin verification error:",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Administrator authentication failed.",
      },
      {
        status: 401,
      }
    );
  }
}