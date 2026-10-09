import crypto from "crypto";

import {
  sendAzureEmail,
} from "@/services/azureEmailServer";

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

const VERIFICATION_EXPIRY_MINUTES =
  30;

const RESEND_COOLDOWN_SECONDS =
  60;

const RESEND_WINDOW_MS =
  60 * 60 * 1000;

const MAX_RESENDS_PER_WINDOW =
  5;

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

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function createRequestError(
  message,
  status,
  code,
  extra = {}
) {
  const error =
    new Error(
      message
    );

  error.status =
    status;

  error.code =
    code;

  Object.assign(
    error,
    extra
  );

  return error;
}

async function sendEmail({
  to,
  replyTo,
  subject,
  html,
}) {
  try {
    const result =
      await sendAzureEmail({
        to,
        replyTo,
        subject,
        html,
      });

    return {
      data: {
        id:
          result?.id ||
          null,
      },

      error:
        null,
    };
  } catch (
    error
  ) {
    return {
      data:
        null,

      error: {
        message:
          error?.message ||
          "Email could not be sent.",
      },
    };
  }
}

export async function POST(
  request
) {
  try {
    await requireAppCheck(
      request
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

    if (
      !registrationId ||
      registrationId.length >
        200
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "We could not resend the verification email. Please restart registration.",

          code:
            "invalid-registration",
        },
        {
          status:
            400,
        }
      );
    }

    const verificationToken =
      crypto
        .randomBytes(
          32
        )
        .toString(
          "hex"
        );

    const verificationTokenHash =
      hashToken(
        verificationToken
      );

    const verificationExpiresAt =
      new Date(
        Date.now() +
          VERIFICATION_EXPIRY_MINUTES *
            60 *
            1000
      ).toISOString();

    let recipientEmail =
      "";

    let firstName =
      "";

    let oldTokenHash =
      null;

    let oldTokenExpiry =
      null;

    let nextResendCount =
      1;

    let resendWindowStartedAt =
      new Date();

    /*
      Read the current registration
      from Cosmos.
    */

    const registration =
      await readCosmosDocument(
        "pendingRegistrations",
        registrationId
      );

    if (
      !registration
    ) {
      throw createRequestError(
        "We could not resend the verification email. Please restart registration.",
        404,
        "registration-not-found"
      );
    }

    /*
      This resend endpoint is
      only for adult email
      verification.

      Minor registrations use
      parental consent resend.
    */

    if (
      registration
        .requiresParentalConsent ===
      true
    ) {
      throw createRequestError(
        "This registration requires parent or guardian consent instead of student email verification.",
        409,
        "parental-consent-required"
      );
    }

    /*
      A verification email can
      only be resent while the
      registration is still
      waiting for verification.
    */

    if (
      registration.status !==
        "pending_email_verification" ||
      registration
        .emailVerificationStatus !==
        "pending"
    ) {
      throw createRequestError(
        "This registration is no longer waiting for email verification.",
        409,
        "verification-not-pending"
      );
    }

    /*
      Prevent two resend
      requests from updating
      the verification token
      at the same time.
    */

    if (
      registration
        .emailVerificationResendInProgress ===
      true
    ) {
      throw createRequestError(
        "A verification email is already being sent. Please wait a moment and try again.",
        409,
        "verification-resend-in-progress"
      );
    }

    recipientEmail =
      typeof registration
        .email ===
      "string"
        ? registration.email
            .trim()
            .toLowerCase()
        : "";

    firstName =
      registration.firstName ||
      "Student";

    if (
      !recipientEmail
    ) {
      throw createRequestError(
        "This registration does not have a valid email address.",
        409,
        "verification-email-missing"
      );
    }

    /*
      Prevent repeated email
      spam.

      Student must wait at
      least 60 seconds between
      verification emails.
    */

    const now =
      Date.now();

    const lastSentAt =
      getDate(
        registration
          .lastEmailVerificationSentAt
      );

    if (
      lastSentAt
    ) {
      const secondsSinceLastSend =
        Math.floor(
          (
            now -
            lastSentAt.getTime()
          ) /
            1000
        );

      const retryAfterSeconds =
        Math.max(
          0,
          RESEND_COOLDOWN_SECONDS -
            secondsSinceLastSend
        );

      if (
        retryAfterSeconds >
        0
      ) {
        throw createRequestError(
          `Please wait ${retryAfterSeconds} seconds before requesting another verification email.`,
          429,
          "verification-resend-cooldown",
          {
            retryAfterSeconds,
          }
        );
      }
    }

    /*
      Also limit the number
      of verification emails
      that can be requested
      during one hour.
    */

    const storedWindowStart =
      getDate(
        registration
          .emailVerificationResendWindowStartedAt
      );

    let currentResendCount =
      Number.isFinite(
        registration
          .emailVerificationResendCount
      )
        ? registration
            .emailVerificationResendCount
        : 0;

    if (
      !storedWindowStart ||
      now -
          storedWindowStart.getTime() >=
        RESEND_WINDOW_MS
    ) {
      resendWindowStartedAt =
        new Date(
          now
        );

      currentResendCount =
        0;
    } else {
      resendWindowStartedAt =
        storedWindowStart;
    }

    if (
      currentResendCount >=
      MAX_RESENDS_PER_WINDOW
    ) {
      const retryAfterSeconds =
        Math.max(
          1,
          Math.ceil(
            (
              RESEND_WINDOW_MS -
              (
                now -
                resendWindowStartedAt.getTime()
              )
            ) /
              1000
          )
        );

      throw createRequestError(
        "Too many verification emails have been requested. Please try again later.",
        429,
        "verification-resend-limit",
        {
          retryAfterSeconds,
        }
      );
    }

    nextResendCount =
      currentResendCount +
      1;

    /*
      Keep the previous token
      temporarily.

      If email sending fails,
      restore the previous
      verification token.
    */

    oldTokenHash =
      registration
        .emailVerificationTokenHash ||
      null;

    oldTokenExpiry =
      registration
        .emailVerificationExpiresAt ||
      null;

    /*
      Store the NEW token
      before sending.

      Requesting a new email
      invalidates the previous
      verification link.

      The ETag on the registration
      also acts as the concurrency
      lock that the old Firestore
      transaction provided.
    */

    let lockedRegistration =
      null;

    try {
      const resendStartedAt =
        cosmosNow();

      lockedRegistration =
        await replaceCosmosDocument(
          "pendingRegistrations",
          registration,
          {
            emailVerificationTokenHash:
              verificationTokenHash,

            emailVerificationExpiresAt:
              verificationExpiresAt,

            emailVerificationResendInProgress:
              true,

            emailVerificationResendStartedAt:
              resendStartedAt,

            updatedAt:
              resendStartedAt,
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
          "A verification email is already being sent. Please wait a moment and try again.",
          409,
          "verification-resend-in-progress"
        );
      }

      throw error;
    }

    const appUrl =
      process.env
        .NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const verificationUrl =
      `${appUrl}/verify-email/${encodeURIComponent(
        registrationId
      )}` +
      `#token=${encodeURIComponent(
        verificationToken
      )}`;

    const safeFirstName =
      escapeHtml(
        firstName
      );

    const emailResult =
      await sendEmail({
        to: [
          recipientEmail,
        ],

        replyTo:
          process.env
            .EMAIL_REPLY_TO ||
          "youth.programs@sait.ca",

        subject:
          "Verify Your Email – SAIT Youth Initiative",

        html: `
          <!doctype html>
          <html lang="en">
            <body
              style="
                margin:0;
                padding:30px;
                background:#f4f5f7;
                font-family:Arial,Helvetica,sans-serif;
                color:#222;
              "
            >
              <div
                style="
                  max-width:620px;
                  margin:auto;
                  background:#ffffff;
                  border-radius:14px;
                  padding:32px;
                  border-top:4px solid #e2232a;
                "
              >
                <div
                  style="
                    color:#e2232a;
                    font-size:34px;
                    font-weight:900;
                  "
                >
                  SAIT
                </div>

                <p
                  style="
                    margin-top:4px;
                    color:#555;
                    font-weight:700;
                  "
                >
                  Youth Initiative
                </p>

                <h1>
                  Verify Your Email
                </h1>

                <p>
                  Hi ${safeFirstName},
                </p>

                <p>
                  A new verification
                  link was requested
                  for your SAIT Youth
                  Initiative
                  registration.
                </p>

                <p>
                  Please verify that
                  this email address
                  belongs to you before
                  continuing with your
                  account setup.
                </p>

                <a
                  href="${verificationUrl}"
                  style="
                    display:inline-block;
                    margin-top:12px;
                    padding:14px 24px;
                    background:#e2232a;
                    color:white;
                    text-decoration:none;
                    border-radius:8px;
                    font-weight:700;
                  "
                >
                  Verify Email
                </a>

                <p
                  style="
                    margin-top:24px;
                    color:#777;
                    font-size:13px;
                  "
                >
                  This secure
                  verification link
                  expires in 30
                  minutes.
                </p>

                <p
                  style="
                    color:#777;
                    font-size:13px;
                  "
                >
                  Requesting a new
                  verification email
                  invalidates the
                  previous verification
                  link.
                </p>

                <p
                  style="
                    color:#777;
                    font-size:13px;
                  "
                >
                  If you did not
                  request this email,
                  you can ignore it or
                  contact
                  youth.programs@sait.ca.
                </p>
              </div>
            </body>
          </html>
        `,
      });

    /*
      If email sending fails, restore the
      previous verification token
      so a previously valid email
      link is not unnecessarily
      destroyed.
    */

    if (
      emailResult.error
    ) {
      try {
        const currentRegistration =
          await readCosmosDocument(
            "pendingRegistrations",
            registrationId
          );

        /*
          Only restore the previous
          token if this request still
          owns the current token.
        */

        if (
          currentRegistration &&
          currentRegistration
            .emailVerificationTokenHash ===
            verificationTokenHash
        ) {
          try {
            await replaceCosmosDocument(
              "pendingRegistrations",
              currentRegistration,
              {
                emailVerificationTokenHash:
                  oldTokenHash,

                emailVerificationExpiresAt:
                  oldTokenExpiry,

                emailVerificationResendInProgress:
                  false,

                emailVerificationResendStartedAt:
                  null,

                lastEmailVerificationResendError:
                  emailResult
                    .error
                    .message ||
                  "Verification email could not be sent.",

                updatedAt:
                  cosmosNow(),
              }
            );
          } catch (
            restoreError
          ) {
            if (
              !isCosmosPreconditionFailed(
                restoreError
              )
            ) {
              throw restoreError;
            }
          }
        }
      } catch (
        restoreError
      ) {
        console.error(
          "Failed to restore previous verification token:",
          restoreError
        );
      }

      return Response.json(
        {
          success:
            false,

          message:
            "We could not send a new verification email. Please try again.",

          code:
            "verification-email-send-failed",
        },
        {
          status:
            502,
        }
      );
    }

    /*
      Complete the resend operation.

      Re-read the registration first
      because another route may have
      legitimately changed it while
      the email was being delivered.
    */

    const currentRegistration =
      await readCosmosDocument(
        "pendingRegistrations",
        registrationId
      );

    if (
      currentRegistration &&
      currentRegistration
        .emailVerificationTokenHash ===
        verificationTokenHash &&
      currentRegistration
        .emailVerificationResendInProgress ===
        true
    ) {
      const emailSentAt =
        cosmosNow();

      try {
        await replaceCosmosDocument(
          "pendingRegistrations",
          currentRegistration,
          {
            emailVerificationResendInProgress:
              false,

            emailVerificationResendStartedAt:
              null,

            emailVerificationResendCount:
              nextResendCount,

            emailVerificationResendWindowStartedAt:
              resendWindowStartedAt.toISOString(),

            lastEmailVerificationResendError:
              null,

            emailStatus:
              "sent",

            emailId:
              emailResult
                .data
                ?.id ||
              null,

            emailError:
              null,

            emailSentAt,

            lastEmailVerificationSentAt:
              emailSentAt,

            updatedAt:
              emailSentAt,
          }
        );
      } catch (
        error
      ) {
        if (
          !isCosmosPreconditionFailed(
            error
          )
        ) {
          throw error;
        }
      }
    }

    return Response.json(
      {
        success:
          true,

        message:
          "A new verification email has been sent. Please check your inbox and spam folder.",

        retryAfterSeconds:
          RESEND_COOLDOWN_SECONDS,
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
      "Email verification resend error:",
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
            "verification-resend-failed",

          ...(
            error.retryAfterSeconds
              ? {
                  retryAfterSeconds:
                    error.retryAfterSeconds,
                }
              : {}
          ),
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
          "We could not resend the verification email. Please try again.",

        code:
          "verification-resend-failed",
      },
      {
        status:
          500,
      }
    );
  }
}