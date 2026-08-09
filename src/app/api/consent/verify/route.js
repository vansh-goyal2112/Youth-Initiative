import crypto from "crypto";

import { adminDb } from "@/services/firebaseAdmin";

export const runtime = "nodejs";

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function POST(request) {
  try {
    const { registrationId, token } = await request.json();

    if (!registrationId || !token) {
      return Response.json(
        {
          success: false,
          message: "The consent link is incomplete.",
        },
        { status: 400 }
      );
    }

    const registrationReference = adminDb
      .collection("pendingRegistrations")
      .doc(registrationId);

    const registrationSnapshot =
      await registrationReference.get();

    if (!registrationSnapshot.exists) {
      return Response.json(
        {
          success: false,
          message: "This registration could not be found.",
        },
        { status: 404 }
      );
    }

    const registration = registrationSnapshot.data();

    if (registration.status === "account_created") {
      return Response.json(
        {
          success: false,
          message: "This account has already been created.",
        },
        { status: 409 }
      );
    }

    const providedTokenHash = hashToken(token);

    if (
      providedTokenHash !== registration.consentTokenHash
    ) {
      return Response.json(
        {
          success: false,
          message: "This consent link is invalid.",
        },
        { status: 401 }
      );
    }

    const expiryDate =
      registration.consentExpiresAt?.toDate?.() ||
      new Date(registration.consentExpiresAt);

    if (expiryDate.getTime() < Date.now()) {
      return Response.json(
        {
          success: false,
          message:
            "This consent link has expired. Please begin registration again.",
        },
        { status: 410 }
      );
    }

    return Response.json({
      success: true,
      registration: {
        registrationId,
        firstName: registration.firstName,
        lastName: registration.lastName,
        email: registration.email,
        dateOfBirth: registration.dateOfBirth,
        status: registration.status,
      },
    });
  } catch (error) {
    console.error("Consent verification error:", error);

    return Response.json(
      {
        success: false,
        message:
          "The consent link could not be verified.",
      },
      { status: 500 }
    );
  }
}