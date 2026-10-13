import crypto from "crypto";

import {
  appCheckErrorResponse,
  requireAppCheck,
} from "@/services/appCheckServer";

import {
  cosmosNow,
  isCosmosPreconditionFailed,
  readCosmosDocument,
  replaceCosmosDocument,
} from "@/services/cosmosData";

export const runtime =
  "nodejs";

const ACTIVATION_EXPIRY_MINUTES =
  30;

function hashToken(
  token
) {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      token
    )
    .digest(
      "hex"
    );
}

function hashesMatch(
  providedHash,
  storedHash
) {
  if (
    typeof providedHash !==
      "string" ||
    typeof storedHash !==
      "string"
  ) {
    return false;
  }

  const providedBuffer =
    Buffer.from(
      providedHash,
      "hex"
    );

  const storedBuffer =
    Buffer.from(
      storedHash,
      "hex"
    );

  if (
    providedBuffer.length !==
    storedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    providedBuffer,
    storedBuffer
  );
}

function getExpiryDate(
  value
) {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(
      value
    );

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function createRequestError(
  message,
  status,
  code
) {
  const error =
    new Error(
      message
    );

  error.status =
    status;

  error.code =
    code;

  return error;
}

export async function POST(
  request
) {
  try {
    /*
      Email verification is a
      token-consuming action.

      Require a limited-use
      App Check token so replay
      protection is also applied
      at the App Check layer.
    */

    await requireAppCheck(
      request,
      {
        consume:
          true,
      }
    );

    const requestBody =
      await request.json();

    const registrationId =
      typeof requestBody
        ?.registrationId ===
      "string"
        ? requestBody
            .registrationId
            .trim()
        : "";

    const token =
      typeof requestBody
        ?.token ===
      "string"
        ? requestBody
            .token
            .trim()
        : "";

    if (
      !registrationId ||
      !token ||
      registrationId.length >
        200 ||
      token.length >
        200
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "The email verification link is invalid.",

          code:
            "invalid-verification-link",
        },
        {
          status:
            400,
        }
      );
    }

    const registration =
      await readCosmosDocument(
        "pendingRegistrations",
        registrationId
      );

    if (
      !registration
    ) {
      throw createRequestError(
        "The email verification link is invalid or has expired.",
        404,
        "registration-not-found"
      );
    }

    /*
      This endpoint is ONLY
      for adult registrations.
    */

    if (
      registration
        .requiresParentalConsent ===
      true
    ) {
      throw createRequestError(
        "This registration requires parent or guardian consent.",
        409,
        "parental-consent-required"
      );
    }

    /*
      The adult must still be
      waiting for email
      verification.

      Once verified, the same
      link cannot be reused.
    */

    if (
      registration.status !==
        "pending_email_verification" ||
      registration
        .emailVerificationStatus !==
        "pending"
    ) {
      throw createRequestError(
        "This email verification link has already been used or is no longer valid.",
        409,
        "verification-not-pending"
      );
    }

    const storedTokenHash =
      registration
        .emailVerificationTokenHash;

    const verificationExpiry =
      getExpiryDate(
        registration
          .emailVerificationExpiresAt
      );

    const providedTokenHash =
      hashToken(
        token
      );

    if (
      !hashesMatch(
        providedTokenHash,
        storedTokenHash
      )
    ) {
      throw createRequestError(
        "The email verification link is invalid.",
        401,
        "invalid-verification-token"
      );
    }

    if (
      !verificationExpiry ||
      verificationExpiry.getTime() <
        Date.now()
    ) {
      throw createRequestError(
        "The email verification link has expired.",
        410,
        "verification-token-expired"
      );
    }

    /*
      Generate a completely new
      token for password setup.

      The email verification token
      itself is NEVER used to create
      the account.
    */

    const activationToken =
      crypto
        .randomBytes(
          32
        )
        .toString(
          "hex"
        );

    const activationTokenHash =
      hashToken(
        activationToken
      );

    const activationExpiresAt =
      new Date(
        Date.now() +
          ACTIVATION_EXPIRY_MINUTES *
            60 *
            1000
      ).toISOString();

    const verifiedAt =
      cosmosNow();

    /*
      Replace the Cosmos document
      using its ETag.

      If another request consumed
      the verification link first,
      Cosmos returns 412 and this
      request cannot overwrite the
      newer document.
    */

    try {
      await replaceCosmosDocument(
        "pendingRegistrations",
        registration,
        {
          emailVerificationStatus:
            "verified",

          emailVerifiedAt:
            verifiedAt,

          emailVerificationTokenHash:
            null,

          emailVerificationExpiresAt:
            null,

          status:
            "email_verified",

          activationTokenHash,

          activationExpiresAt,

          updatedAt:
            verifiedAt,
        }
      );
    } catch (
      error
    ) {
      if (
        isCosmosPreconditionFailed(
          error
        )
      ) {
        throw createRequestError(
          "This email verification link has already been used or is no longer valid.",
          409,
          "verification-not-pending"
        );
      }

      throw error;
    }

    /*
      Return the plaintext activation
      token exactly once.

      The browser will immediately
      pass this to the existing
      set-password page.
    */

    return Response.json(
      {
        success:
          true,

        message:
          "Your email address has been verified.",

        registrationId,

        firstName:
          registration.firstName ||
          "",

        nextStep:
          "set_password",

        activationToken,
      },
      {
        status:
          200,
      }
    );
  } catch (
    error
  ) {
    const appCheckResponse =
      appCheckErrorResponse(
        error
      );

    if (
      appCheckResponse
    ) {
      return appCheckResponse;
    }

    console.error(
      "Adult email verification error:",
      error
    );

    if (
      error?.status
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            error.message,

          code:
            error.code ||
            "email-verification-failed",
        },
        {
          status:
            error.status,
        }
      );
    }

    return Response.json(
      {
        success:
          false,

        message:
          "Your email address could not be verified. Please try again.",

        code:
          "email-verification-failed",
      },
      {
        status:
          500,
      }
    );
  }
}