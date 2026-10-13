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

export const runtime = "nodejs";

const RESET_TOKEN_EXPIRY_MINUTES =
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
    typeof providedHash !== "string" ||
    typeof storedHash !== "string"
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

function getDate(
  value
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function verificationError(
  message,
  status
) {
  return Response.json(
    {
      success:
        false,

      message,
    },
    {
      status,
    }
  );
}

export async function POST(
  request
) {
  try {
    const {
      requestId,
      token,
      approve,
    } =
      await request.json();

    /*
      Checking the link uses a
      normal App Check token.

      Actually approving the
      reset consumes a limited-use
      App Check token.
    */

    await requireAppCheck(
      request,
      {
        consume:
          approve === true,
      }
    );

    if (
      typeof requestId !==
        "string" ||
      !requestId.trim() ||
      typeof token !==
        "string" ||
      !token.trim()
    ) {
      return verificationError(
        "Verification link is incomplete.",
        400
      );
    }

    const normalizedRequestId =
      requestId.trim();

    const normalizedToken =
      token.trim();

    /*
      ------------------------------------------------
      LINK CHECK ONLY

      The parent page calls this first with:
      approve: false

      Nothing is consumed or changed.
      ------------------------------------------------
    */

    if (
      approve !== true
    ) {
      const reset =
        await readCosmosDocument(
          "passwordResetRequests",
          normalizedRequestId
        );

      if (
        !reset
      ) {
        return verificationError(
          "This password reset link is unavailable.",
          404
        );
      }

      /*
        This route is only for
        guardian verification.

        Adults bypass this page
        and receive their reset
        token directly by email.
      */

      if (
        reset.recoveryMode !==
          "guardian" ||
        reset
          .requiresGuardianApproval !==
          true
      ) {
        return verificationError(
          "This verification link is not valid for this recovery request.",
          400
        );
      }

      if (
        reset.status !==
        "pending_guardian_verification"
      ) {
        if (
          reset.status ===
            "ready_for_reset" ||
          reset.guardianVerified ===
            true
        ) {
          return verificationError(
            "This verification link has already been used.",
            409
          );
        }

        if (
          reset.status ===
          "completed"
        ) {
          return verificationError(
            "This password reset has already been completed.",
            409
          );
        }

        return verificationError(
          "This password reset request is no longer available.",
          409
        );
      }

      const expiry =
        getDate(
          reset
            .verificationExpiresAt
        );

      if (
        !expiry ||
        expiry.getTime() <
          Date.now()
      ) {
        return verificationError(
          "This verification link has expired.",
          410
        );
      }

      const providedHash =
        hashToken(
          normalizedToken
        );

      if (
        !hashesMatch(
          providedHash,
          reset
            .verificationTokenHash
        )
      ) {
        return verificationError(
          "Verification token is invalid.",
          401
        );
      }

      return Response.json(
        {
          success:
            true,

          verified:
            false,

          readyForApproval:
            true,
        }
      );
    }

    /*
      ------------------------------------------------
      PARENT APPROVES

      The guardian verification
      token is NOT reused as the
      password-reset token.

      A completely new one-time
      reset token is generated.
      ------------------------------------------------
    */

    const resetToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    const resetTokenHash =
      hashToken(
        resetToken
      );

    const resetTokenExpiresAt =
      new Date(
        Date.now() +
          RESET_TOKEN_EXPIRY_MINUTES *
            60 *
            1000
      ).toISOString();

    const reset =
      await readCosmosDocument(
        "passwordResetRequests",
        normalizedRequestId
      );

    if (
      !reset
    ) {
      throw new Error(
        "RESET_NOT_FOUND"
      );
    }

    if (
      reset.recoveryMode !==
        "guardian" ||
      reset
        .requiresGuardianApproval !==
        true
    ) {
      throw new Error(
        "INVALID_RECOVERY_MODE"
      );
    }

    if (
      reset.status ===
        "ready_for_reset" ||
      reset.guardianVerified ===
        true
    ) {
      throw new Error(
        "ALREADY_VERIFIED"
      );
    }

    if (
      reset.status ===
      "completed"
    ) {
      throw new Error(
        "RESET_COMPLETED"
      );
    }

    if (
      reset.status !==
      "pending_guardian_verification"
    ) {
      throw new Error(
        "RESET_UNAVAILABLE"
      );
    }

    const expiry =
      getDate(
        reset
          .verificationExpiresAt
      );

    if (
      !expiry ||
      expiry.getTime() <
        Date.now()
    ) {
      throw new Error(
        "VERIFICATION_EXPIRED"
      );
    }

    const providedHash =
      hashToken(
        normalizedToken
      );

    if (
      !hashesMatch(
        providedHash,
        reset
          .verificationTokenHash
      )
    ) {
      throw new Error(
        "INVALID_TOKEN"
      );
    }

    const youthId =
      reset.youthId ||
      null;

    /*
      Consume the guardian token
      and create the separate
      password-reset authorization.

      ETag protection replaces the
      Firestore transaction.

      If another request approves
      the same link first, Cosmos
      rejects this stale update.
    */

    const verificationUsedAt =
      cosmosNow();

    try {
      await replaceCosmosDocument(
        "passwordResetRequests",
        reset,
        {
          guardianVerified:
            true,

          status:
            "ready_for_reset",

          verificationTokenHash:
            null,

          verificationUsedAt,

          resetTokenHash,

          resetExpiresAt:
            resetTokenExpiresAt,

          updatedAt:
            verificationUsedAt,
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
        throw new Error(
          "ALREADY_VERIFIED"
        );
      }

      throw error;
    }

    /*
      The plaintext reset token is
      returned only once.

      Cosmos stores only its hash.
    */

    return Response.json(
      {
        success:
          true,

        verified:
          true,

        youthId,

        resetToken,
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

    const errorCode =
      error?.message;

    if (
      errorCode ===
      "RESET_NOT_FOUND"
    ) {
      return verificationError(
        "This password reset link is unavailable.",
        404
      );
    }

    if (
      errorCode ===
      "INVALID_RECOVERY_MODE"
    ) {
      return verificationError(
        "This verification link is not valid for this recovery request.",
        400
      );
    }

    if (
      errorCode ===
      "ALREADY_VERIFIED"
    ) {
      return verificationError(
        "This verification link has already been used.",
        409
      );
    }

    if (
      errorCode ===
      "RESET_COMPLETED"
    ) {
      return verificationError(
        "This password reset has already been completed.",
        409
      );
    }

    if (
      errorCode ===
      "RESET_UNAVAILABLE"
    ) {
      return verificationError(
        "This password reset request is no longer available.",
        409
      );
    }

    if (
      errorCode ===
      "VERIFICATION_EXPIRED"
    ) {
      return verificationError(
        "This verification link has expired.",
        410
      );
    }

    if (
      errorCode ===
      "INVALID_TOKEN"
    ) {
      return verificationError(
        "Verification token is invalid.",
        401
      );
    }

    console.error(
      "Password reset verification error:",
      error?.message
    );

    return Response.json(
      {
        success:
          false,

        message:
          "Verification could not be completed.",
      },
      {
        status:
          500,
      }
    );
  }
}