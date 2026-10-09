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

const CONSENT_TERMS_VERSION =
  "2026-09-v1";

const ACTIVATION_TOKEN_EXPIRY_MINUTES =
  30;

function hashToken(
  token
) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
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
      providedHash
    );

  const storedBuffer =
    Buffer.from(
      storedHash
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

function getExpiryDate(
  value
) {
  if (!value) {
    return null;
  }

  const expiryDate =
    new Date(
      value
    );

  if (
    Number.isNaN(
      expiryDate.getTime()
    )
  ) {
    return null;
  }

  return expiryDate;
}

export async function POST(
  request
) {
  try {
    await requireAppCheck(
      request,
      {
        consume:
          true,
      }
    );

    const {
      registrationId,
      token,
      guardianConfirmed,
      termsAccepted,
    } =
      await request.json();

    if (
      typeof registrationId !==
        "string" ||
      !registrationId.trim() ||
      typeof token !==
        "string" ||
      !token.trim()
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "The consent request is incomplete.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      guardianConfirmed !==
        true ||
      termsAccepted !==
        true
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "Both consent confirmations are required.",
        },
        {
          status:
            400,
        }
      );
    }

    const normalizedRegistrationId =
      registrationId.trim();

    const registration =
      await readCosmosDocument(
        "pendingRegistrations",
        normalizedRegistrationId
      );

    if (
      !registration
    ) {
      throw createRequestError(
        "This registration could not be found.",
        404,
        "registration-not-found"
      );
    }

    if (
      registration
        .requiresParentalConsent !==
      true
    ) {
      throw createRequestError(
        "Parental consent is not required for this registration.",
        400,
        "consent-not-required"
      );
    }

    if (
      registration.status ===
        "consent_approved" ||
      registration.consentStatus ===
        "approved"
    ) {
      throw createRequestError(
        "Consent has already been recorded for this registration.",
        409,
        "consent-already-approved"
      );
    }

    if (
      registration.status ===
      "account_created"
    ) {
      throw createRequestError(
        "This account has already been created.",
        409,
        "account-already-created"
      );
    }

    if (
      registration.status !==
        "pending_consent" ||
      registration.consentStatus !==
        "pending"
    ) {
      throw createRequestError(
        "This consent request is no longer available.",
        409,
        "invalid-consent-state"
      );
    }

    const providedTokenHash =
      hashToken(
        token.trim()
      );

    if (
      !hashesMatch(
        providedTokenHash,
        registration
          .consentTokenHash
      )
    ) {
      throw createRequestError(
        "This consent link is invalid.",
        401,
        "invalid-consent-token"
      );
    }

    const expiryDate =
      getExpiryDate(
        registration
          .consentExpiresAt
      );

    if (
      !expiryDate ||
      expiryDate.getTime() <
        Date.now()
    ) {
      throw createRequestError(
        "This consent link has expired. Please begin registration again.",
        410,
        "consent-token-expired"
      );
    }

    /*
      Generate a separate
      account activation token.

      The parental consent token
      is destroyed after approval.
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
          ACTIVATION_TOKEN_EXPIRY_MINUTES *
            60 *
            1000
      ).toISOString();

    const consentApprovedAt =
      cosmosNow();

    /*
      Record the consent using
      the current Cosmos document
      ETag.

      If another request modifies
      or consumes this consent
      first, the conditional
      replacement fails instead
      of overwriting it.
    */

    try {
      await replaceCosmosDocument(
        "pendingRegistrations",
        registration,
        {
          consentStatus:
            "approved",

          status:
            "consent_approved",

          guardianConfirmed:
            true,

          termsAccepted:
            true,

          consentTermsVersion:
            CONSENT_TERMS_VERSION,

          consentApprovedAt,

          consentTokenUsedAt:
            consentApprovedAt,

          consentTokenHash:
            null,

          activationTokenHash,

          activationExpiresAt,

          updatedAt:
            consentApprovedAt,
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
          "Consent has already been recorded for this registration.",
          409,
          "consent-already-approved"
        );
      }

      throw error;
    }

    return Response.json(
      {
        success:
          true,

        message:
          "Parental consent recorded successfully.",

        registrationId:
          normalizedRegistrationId,

        activationToken,
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
      "Consent approval error:",
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
            error.code,
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
          "We could not record parental consent. Please try again.",
      },
      {
        status:
          500,
      }
    );
  }
}