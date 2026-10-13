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
  createCosmosDocument,
  isCosmosConflict,
  isCosmosPreconditionFailed,
  queryCosmosDocuments,
  readCosmosDocument,
  replaceCosmosDocument,
} from "@/services/cosmosData";

export const runtime =
  "nodejs";

const REQUEST_COOLDOWN_SECONDS =
  60;

const MAX_REQUESTS_PER_HOUR =
  5;

function normalizeEmail(
  value
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .toLowerCase();
}

function isValidEmail(
  email
) {
  return (
    email.length <=
      254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  );
}

function hashValue(
  value
) {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      value
    )
    .digest(
      "hex"
    );
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

function genericResponse() {
  return Response.json(
    {
      success:
        true,

      message:
        "If the email is associated with an eligible Youth Initiative account, the Youth ID will be sent shortly.",
    },
    {
      status:
        200,
    }
  );
}

async function checkRateLimit(
  email
) {
  /*
    Do not store the email itself
    as the rate-limit document ID.

    Store only a SHA-256 hash.
  */

  const rateLimitId =
    hashValue(
      email
    );

  /*
    Cosmos optimistic concurrency
    replaces the Firestore
    transaction.

    Retry if another request changes
    the same hashed-email rate-limit
    document at the same time.
  */

  for (
    let attempt = 0;
    attempt < 5;
    attempt += 1
  ) {
    const now =
      new Date();

    const nowIso =
      now.toISOString();

    const rateLimit =
      await readCosmosDocument(
        "youthIdRecoveryRateLimits",
        rateLimitId
      );

    /*
      First request for this email.
    */

    if (
      !rateLimit
    ) {
      try {
        await createCosmosDocument(
          "youthIdRecoveryRateLimits",
          {
            id:
              rateLimitId,

            requestCount:
              1,

            windowStartedAt:
              nowIso,

            lastRequestedAt:
              nowIso,

            updatedAt:
              nowIso,
          }
        );

        return true;
      } catch (
        error
      ) {
        /*
          Another request may have
          created the record after
          our read.

          Retry using the newly
          created document.
        */

        if (
          isCosmosConflict(
            error
          )
        ) {
          continue;
        }

        throw error;
      }
    }

    const lastRequestedAt =
      getDate(
        rateLimit
          .lastRequestedAt
      );

    const windowStartedAt =
      getDate(
        rateLimit
          .windowStartedAt
      );

    if (
      lastRequestedAt
    ) {
      const secondsSinceLastRequest =
        (
          now.getTime() -
          lastRequestedAt.getTime()
        ) /
        1000;

      if (
        secondsSinceLastRequest <
        REQUEST_COOLDOWN_SECONDS
      ) {
        return false;
      }
    }

    const hourInMilliseconds =
      60 *
      60 *
      1000;

    const currentWindowExpired =
      !windowStartedAt ||
      now.getTime() -
          windowStartedAt.getTime() >=
        hourInMilliseconds;

    if (
      currentWindowExpired
    ) {
      try {
        await replaceCosmosDocument(
          "youthIdRecoveryRateLimits",
          rateLimit,
          {
            requestCount:
              1,

            windowStartedAt:
              nowIso,

            lastRequestedAt:
              nowIso,

            updatedAt:
              nowIso,
          }
        );

        return true;
      } catch (
        error
      ) {
        if (
          isCosmosPreconditionFailed(
            error
          )
        ) {
          continue;
        }

        throw error;
      }
    }

    const currentCount =
      Number(
        rateLimit
          .requestCount ||
        0
      );

    if (
      currentCount >=
      MAX_REQUESTS_PER_HOUR
    ) {
      return false;
    }

    try {
      await replaceCosmosDocument(
        "youthIdRecoveryRateLimits",
        rateLimit,
        {
          requestCount:
            currentCount +
            1,

          lastRequestedAt:
            nowIso,

          updatedAt:
            nowIso,
        }
      );

      return true;
    } catch (
      error
    ) {
      if (
        isCosmosPreconditionFailed(
          error
        )
      ) {
        continue;
      }

      throw error;
    }
  }

  /*
    If repeated concurrency
    conflicts prevent a safe
    rate-limit update, deny the
    request rather than bypass
    the limit.
  */

  return false;
}

function accountIsEligible(
  student
) {
  return (
    student?.role ===
      "student" &&
    student?.accountStatus ===
      "active" &&
    typeof student?.youthId ===
      "string" &&
    Boolean(
      student.youthId.trim()
    )
  );
}

export async function POST(
  request
) {
  try {
    await requireAppCheck(
      request
    );

    const {
      email,
    } =
      await request.json();

    const cleanedEmail =
      normalizeEmail(
        email
      );

    if (
      !cleanedEmail ||
      !isValidEmail(
        cleanedEmail
      )
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "Please enter a valid email address.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
      Apply rate limiting even if
      the email is not associated
      with an account.

      This prevents someone from
      using response timing to learn
      whether an account exists.
    */

    const allowed =
      await checkRateLimit(
        cleanedEmail
      );

    if (
      !allowed
    ) {
      return genericResponse();
    }

    /*
      Adults recover using their
      verified contact email.

      Minors recover using the
      parent or guardian email that
      approved the account.

      Run both searches because one
      parent may have more than one
      student account.
    */

    const [
      contactEmailStudents,
      parentEmailStudents,
    ] =
      await Promise.all([
        queryCosmosDocuments(
          "students",
          `
            SELECT TOP 10 *
            FROM c
            WHERE c.contactEmail = @email
          `,
          [
            {
              name:
                "@email",

              value:
                cleanedEmail,
            },
          ]
        ),

        queryCosmosDocuments(
          "students",
          `
            SELECT TOP 10 *
            FROM c
            WHERE c.parentEmail = @email
          `,
          [
            {
              name:
                "@email",

              value:
                cleanedEmail,
            },
          ]
        ),
      ]);

    const eligibleAccounts =
      new Map();

    for (
      const student of
      contactEmailStudents
    ) {
      if (
        !accountIsEligible(
          student
        )
      ) {
        continue;
      }

      /*
        Only send a Youth ID to a
        student's contact email if
        ownership of that email has
        actually been verified.
      */

      if (
        student
          .contactEmailVerified !==
        true
      ) {
        continue;
      }

      eligibleAccounts.set(
        student.id,
        {
          firstName:
            student.firstName ||
            "Student",

          youthId:
            student.youthId,
        }
      );
    }

    for (
      const student of
      parentEmailStudents
    ) {
      if (
        !accountIsEligible(
          student
        )
      ) {
        continue;
      }

      /*
        Parent-email recovery is
        only valid for accounts that
        actually required parental
        consent and have approved
        consent.
      */

      if (
        student
          .requiresParentalConsent !==
          true ||
        student
          .consentStatus !==
          "approved"
      ) {
        continue;
      }

      eligibleAccounts.set(
        student.id,
        {
          firstName:
            student.firstName ||
            "Student",

          youthId:
            student.youthId,
        }
      );
    }

    /*
      Never tell the requester
      whether the account exists.
    */

    if (
      eligibleAccounts.size ===
      0
    ) {
      return genericResponse();
    }

    const accountRows =
      Array.from(
        eligibleAccounts.values()
      )
        .map(
          (
            account
          ) => {
            const safeFirstName =
              escapeHtml(
                account.firstName
              );

            const safeYouthId =
              escapeHtml(
                account.youthId
              );

            return `
              <div
                style="
                  margin:14px 0;
                  padding:16px;
                  background:#f4f5f7;
                  border-radius:10px;
                "
              >
                <div
                  style="
                    font-size:14px;
                    color:#666;
                    margin-bottom:5px;
                  "
                >
                  ${safeFirstName}
                </div>

                <div
                  style="
                    font-size:22px;
                    font-weight:900;
                    letter-spacing:1px;
                    color:#222;
                  "
                >
                  ${safeYouthId}
                </div>
              </div>
            `;
          }
        )
        .join(
          ""
        );

    const appUrl =
      process.env
        .NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    try {
      await sendAzureEmail(
        {
          to: [
            cleanedEmail,
          ],

          replyTo:
            process.env
              .EMAIL_REPLY_TO ||
            "youth.programs@sait.ca",

          subject:
            "Your Youth Initiative ID",

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
                    Your Youth Initiative ID
                  </h1>

                  <p>
                    A request was made to
                    recover the Youth
                    Initiative ID associated
                    with this email address.
                  </p>

                  ${accountRows}

                  <p>
                    Use your Youth Initiative
                    ID and password to sign in.
                  </p>

                  <a
                    href="${appUrl}/login"
                    style="
                      display:inline-block;
                      margin-top:12px;
                      padding:14px 24px;
                      background:#e2232a;
                      color:#ffffff;
                      text-decoration:none;
                      border-radius:8px;
                      font-weight:700;
                    "
                  >
                    Sign In
                  </a>

                  <p
                    style="
                      margin-top:28px;
                      color:#777;
                      font-size:13px;
                      line-height:1.6;
                    "
                  >
                    If you did not request
                    this message, no action
                    is required.
                  </p>

                  <p
                    style="
                      color:#777;
                      font-size:13px;
                      line-height:1.6;
                    "
                  >
                    For assistance, reply to
                    this email or contact
                    youth.programs@sait.ca.
                  </p>
                </div>
              </body>
            </html>
          `,
        }
      );
    } catch (
      emailError
    ) {
      console.error(
        "Youth ID recovery email error:",
        emailError
      );

      return genericResponse();
    }

    return genericResponse();
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
      "Youth ID recovery request error:",
      error
    );

    return Response.json(
      {
        success:
          false,

        message:
          "Youth ID recovery could not be started. Please try again.",
      },
      {
        status:
          500,
      }
    );
  }
}