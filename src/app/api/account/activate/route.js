import crypto from "crypto";

import {
  adminAuth,
} from "@/services/firebaseAdmin";

import {
  appCheckErrorResponse,
  requireAppCheck,
} from "@/services/appCheckServer";

import {
  sendWelcomeEmail,
} from "@/services/accountEmailServer";

import {
  cosmosNow,
  createCosmosDocument,
  deleteCosmosDocument,
  isCosmosConflict,
  isCosmosPreconditionFailed,
  readCosmosDocument,
  replaceCosmosDocument,
} from "@/services/cosmosData";

export const runtime =
  "nodejs";

const YOUTH_ID_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

function createRandomYouthId() {
  let randomPart =
    "";

  for (
    let index = 0;
    index < 12;
    index += 1
  ) {
    randomPart +=
      YOUTH_ID_ALPHABET[
        crypto.randomInt(
          0,
          YOUTH_ID_ALPHABET.length
        )
      ];
  }

  return `YI-${randomPart}`;
}

async function reserveUniqueYouthId(
  registrationId
) {
  for (
    let attempt = 0;
    attempt < 15;
    attempt += 1
  ) {
    const youthId =
      createRandomYouthId();

    const reservationId =
      youthId.toLowerCase();

    try {
      const reservation =
        await createCosmosDocument(
          "youthIdReservations",
          {
            id:
              reservationId,

            youthId,

            registrationId,

            status:
              "reserved",

            createdAt:
              cosmosNow(),
          }
        );

      return {
        youthId,
        reservation,
      };
    } catch (
      error
    ) {
      /*
        Creating a document with
        the same Youth ID fails
        with a Cosmos conflict.

        Generate another random
        Youth ID and try again.
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

  throw new Error(
    "A unique Youth Initiative ID could not be generated."
  );
}

function validatePassword(
  password,
  registration
) {
  if (
    typeof password !==
      "string"
  ) {
    return "Password is required.";
  }

  if (
    password.length < 10 ||
    password.length > 64
  ) {
    return "Password must contain between 10 and 64 characters.";
  }

  if (
    !/[A-Z]/.test(
      password
    )
  ) {
    return "Password must contain an uppercase letter.";
  }

  if (
    !/[a-z]/.test(
      password
    )
  ) {
    return "Password must contain a lowercase letter.";
  }

  if (
    !/[0-9]/.test(
      password
    )
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

  const passwordLower =
    password.toLowerCase();

  if (
    passwordLower.includes(
      registration.firstName.toLowerCase()
    ) ||
    passwordLower.includes(
      registration.lastName.toLowerCase()
    )
  ) {
    return "Password cannot contain the student's name.";
  }

  return null;
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
  if (
    !value
  ) {
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

export async function POST(
  request
) {
  let createdUser =
    null;

  let youthIdReservation =
    null;

  let studentDocument =
    null;

  let registrationId =
    "";

  let activationClaimed =
    false;

  let accountCommitted =
    false;

  try {
    /*
      Account activation is a
      sensitive one-time action.

      The frontend sends a
      limited-use App Check token,
      so consume it here.
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

    const token =
      typeof requestBody
        ?.token ===
      "string"
        ? requestBody
            .token
            .trim()
        : "";

    const password =
      requestBody
        ?.password;

    const confirmPassword =
      requestBody
        ?.confirmPassword;

    registrationId =
      typeof requestBody
        ?.registrationId ===
      "string"
        ? requestBody
            .registrationId
            .trim()
        : "";

    if (
      !registrationId ||
      !token ||
      typeof password !==
        "string" ||
      typeof confirmPassword !==
        "string"
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "All password fields are required.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      password !==
      confirmPassword
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "Passwords do not match.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
      Read the pending registration
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
        "The registration could not be found.",
        404,
        "registration-not-found"
      );
    }

    if (
      registration.status ===
      "account_created"
    ) {
      throw createRequestError(
        "This account has already been activated.",
        409,
        "account-already-created"
      );
    }

    if (
      registration
        .activationInProgress ===
      true
    ) {
      throw createRequestError(
        "This account is already being activated. Please wait and try again.",
        409,
        "activation-in-progress"
      );
    }

    const requiresParentalConsent =
      registration
        .requiresParentalConsent ===
      true;

    let storedTokenHash =
      null;

    let tokenExpiry =
      null;

    /*
      MINOR FLOW

      Parent or guardian consent
      must already be approved.

      /api/consent/approve creates
      a separate activation token.
    */

    if (
      requiresParentalConsent
    ) {
      if (
        registration.status !==
          "consent_approved" ||
        registration.consentStatus !==
          "approved"
      ) {
        throw createRequestError(
          "Parental consent must be completed before this account can be activated.",
          403,
          "consent-required"
        );
      }

      storedTokenHash =
        registration
          .activationTokenHash;

      tokenExpiry =
        getExpiryDate(
          registration
            .activationExpiresAt
        );
    } else {
      /*
        ADULT FLOW

        The contact email must
        already have been verified.

        /api/email-verification/verify
        creates the activation token
        used here.

        The original email
        verification token can never
        activate an account.
      */

      if (
        registration.status !==
          "email_verified" ||
        registration
          .emailVerificationStatus !==
          "verified" ||
        registration.consentStatus !==
          "not_required"
      ) {
        throw createRequestError(
          "Please verify your email address before creating your account.",
          403,
          "email-verification-required"
        );
      }

      storedTokenHash =
        registration
          .activationTokenHash;

      tokenExpiry =
        getExpiryDate(
          registration
            .activationExpiresAt
        );
    }

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
        "The account setup link is invalid.",
        401,
        "invalid-activation-token"
      );
    }

    if (
      !tokenExpiry ||
      tokenExpiry.getTime() <
        Date.now()
    ) {
      throw createRequestError(
        "The account setup link has expired.",
        410,
        "activation-token-expired"
      );
    }

    const passwordError =
      validatePassword(
        password,
        registration
      );

    if (
      passwordError
    ) {
      throw createRequestError(
        passwordError,
        400,
        "invalid-password"
      );
    }

    /*
      Claim the activation.

      This uses the registration's
      current Cosmos ETag.

      If another activation request
      updates this document first,
      this conditional replacement
      fails rather than allowing two
      accounts to be created.
    */

    let lockedRegistration =
      null;

    try {
      const activationStartedAt =
        cosmosNow();

      lockedRegistration =
        await replaceCosmosDocument(
          "pendingRegistrations",
          registration,
          {
            activationInProgress:
              true,

            activationStartedAt,

            updatedAt:
              activationStartedAt,
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
          "This account is already being activated. Please wait and try again.",
          409,
          "activation-in-progress"
        );
      }

      throw error;
    }

    activationClaimed =
      true;

    /*
      Generate a random Youth ID.

      The ID contains no name,
      birth date or other personal
      information.
    */

    youthIdReservation =
      await reserveUniqueYouthId(
        registrationId
      );

    const youthId =
      youthIdReservation
        .youthId;

    const internalEmail =
      `${youthId.toLowerCase()}@youthinitiative.local`;

    /*
      Firebase Authentication
      securely stores the password.

      Firebase Auth remains
      temporarily during this
      database migration.

      The password is never stored
      in Cosmos DB.
    */

    createdUser =
      await adminAuth.createUser(
        {
          email:
            internalEmail,

          password,

          displayName:
            `${registration.firstName} ${registration.lastName}`,

          /*
            This is the internal
            Youth-ID Firebase account.

            It is not claiming that
            the contact email itself
            is the Firebase Auth email.
          */

          emailVerified:
            true,

          disabled:
            false,
        }
      );

    /*
      Create the student document
      in Cosmos.

      The document ID remains the
      Firebase UID so the current
      Firebase authentication flow
      continues to map to the same
      student record.
    */

    const accountCreatedAt =
      cosmosNow();

    studentDocument =
      await createCosmosDocument(
        "students",
        {
          id:
            createdUser.uid,

          firebaseUid:
            createdUser.uid,

          registrationId,

          firstName:
            registration.firstName,

          lastName:
            registration.lastName,

          fullName:
            `${registration.firstName} ${registration.lastName}`,

          contactEmail:
            registration.email,

          /*
            Adults proved ownership of
            their contact email during
            registration.

            Minor student contact email
            ownership is not independently
            verified by the parental
            consent flow.
          */

          contactEmailVerified:
            registration
              .requiresParentalConsent ===
            true
              ? false
              : registration
                    .emailVerificationStatus ===
                  "verified",

          contactEmailVerifiedAt:
            registration
              .requiresParentalConsent ===
            true
              ? null
              : registration
                  .emailVerifiedAt ||
                null,

          parentEmail:
            registration.parentEmail ||
            null,

          internalEmail,

          youthId,

          dateOfBirth:
            registration.dateOfBirth,

          requiresParentalConsent:
            registration
              .requiresParentalConsent ===
            true,

          role:
            "student",

          accountStatus:
            "active",

          consentStatus:
            registration
              .requiresParentalConsent ===
            true
              ? "approved"
              : "not_required",

          learningMode:
            null,

          interests:
            [],

          onboardingCompleted:
            false,

          totalXp:
            0,

          level:
            1,

          badgeCount:
            0,

          completedWorkshopCount:
            0,

          currentStreak:
            0,

          createdAt:
            accountCreatedAt,

          updatedAt:
            accountCreatedAt,

          lastLoginAt:
            null,
        }
      );

    /*
      Mark the Youth ID reservation
      as assigned.

      The ETag prevents another
      process from silently replacing
      a changed reservation.
    */

    const assignedAt =
      cosmosNow();

    try {
      youthIdReservation.reservation =
        await replaceCosmosDocument(
          "youthIdReservations",
          youthIdReservation
            .reservation,
          {
            status:
              "assigned",

            firebaseUid:
              createdUser.uid,

            assignedAt,
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
          "The Youth Initiative ID could not be assigned. Please try again.",
          409,
          "youth-id-assignment-conflict"
        );
      }

      throw error;
    }

    /*
      Finalize the pending
      registration.

      BOTH adult and minor flows
      use a separate activation
      token.

      Remove that token after the
      account has been created.
    */

    const activationCompletedAt =
      cosmosNow();

    const registrationUpdate =
      {
        firebaseUid:
          createdUser.uid,

        youthId,

        internalEmail,

        status:
          "account_created",

        accountCreatedAt:
          activationCompletedAt,

        activationTokenHash:
          null,

        activationExpiresAt:
          null,

        activationInProgress:
          false,

        activationStartedAt:
          null,

        activationCompletedAt,

        updatedAt:
          activationCompletedAt,
      };

    /*
      Clean any obsolete setup
      material as defense-in-depth.
    */

    if (
      registration
        .requiresParentalConsent ===
      true
    ) {
      registrationUpdate.consentTokenHash =
        null;

      registrationUpdate.consentExpiresAt =
        null;
    } else {
      registrationUpdate.emailVerificationTokenHash =
        null;

      registrationUpdate.emailVerificationExpiresAt =
        null;

      /*
        These fields belonged to the
        older adult registration flow.

        Clearing them is safe if they
        happen to exist.
      */

      registrationUpdate.consentTokenHash =
        null;

      registrationUpdate.consentExpiresAt =
        null;
    }

    try {
      await replaceCosmosDocument(
        "pendingRegistrations",
        lockedRegistration,
        registrationUpdate
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
          "This registration changed while the account was being activated. Please try again.",
          409,
          "activation-state-conflict"
        );
      }

      throw error;
    }

    /*
      At this point all account
      records required for the
      successful activation exist.

      Do not run rollback cleanup
      after this point.
    */

    accountCommitted =
      true;

    activationClaimed =
      false;

    /*
      Welcome email is best-effort.

      Email delivery must never undo
      or fail a successfully created
      Firebase / Cosmos account.
    */

    try {
      const welcomeEmailResult =
        await sendWelcomeEmail(
          {
            firstName:
              registration.firstName,

            email:
              registration.email,

            parentEmail:
              registration.parentEmail ||
              null,

            youthId,

            requiresParentalConsent:
              registration
                .requiresParentalConsent ===
              true,
          }
        );

      if (
        !welcomeEmailResult.success
      ) {
        console.error(
          "Welcome email was not sent:",
          welcomeEmailResult.error
        );
      }
    } catch (
      welcomeEmailError
    ) {
      console.error(
        "Unexpected welcome email error:",
        welcomeEmailError
      );
    }

    return Response.json(
      {
        success:
          true,

        youthId,

        firstName:
          registration.firstName,
      },
      {
        status:
          201,
      }
    );
  } catch (
    error
  ) {
    /*
      App Check errors should
      return the App Check
      response.
    */

    const appCheckResponse =
      appCheckErrorResponse(
        error
      );

    if (
      appCheckResponse &&
      error?.code !==
        "invalid-activation-token"
    ) {
      return appCheckResponse;
    }

    console.error(
      "Account activation error:",
      error
    );

    /*
      The old Firestore implementation
      used one cross-collection batch.

      Cosmos transactions cannot span
      these separate containers, so if
      activation fails before the final
      registration commit, clean up any
      records created by this attempt.
    */

    if (
      !accountCommitted
    ) {
      /*
        Remove the Cosmos student
        document if it was created.
      */

      if (
        studentDocument?.id
      ) {
        try {
          await deleteCosmosDocument(
            "students",
            studentDocument.id
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "Failed to clean up student document:",
            cleanupError
          );
        }
      }

      /*
        If Firebase Auth was created
        but Cosmos activation failed,
        remove the Firebase user so a
        broken account is not left
        behind.
      */

      if (
        createdUser?.uid
      ) {
        try {
          await adminAuth.deleteUser(
            createdUser.uid
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "Failed to clean up Auth user:",
            cleanupError
          );
        }
      }

      /*
        Remove the unused Youth ID
        reservation after failure.
      */

      if (
        youthIdReservation
          ?.reservation
          ?.id
      ) {
        try {
          await deleteCosmosDocument(
            "youthIdReservations",
            youthIdReservation
              .reservation
              .id
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "Failed to clean up Youth ID reservation:",
            cleanupError
          );
        }
      }

      /*
        Release the activation lock
        so the user can retry while
        the activation token remains
        valid.
      */

      if (
        activationClaimed &&
        registrationId
      ) {
        try {
          const currentRegistration =
            await readCosmosDocument(
              "pendingRegistrations",
              registrationId
            );

          if (
            currentRegistration &&
            currentRegistration.status !==
              "account_created" &&
            currentRegistration
              .activationInProgress ===
              true
          ) {
            await replaceCosmosDocument(
              "pendingRegistrations",
              currentRegistration,
              {
                activationInProgress:
                  false,

                activationStartedAt:
                  null,

                updatedAt:
                  cosmosNow(),
              }
            );
          }
        } catch (
          cleanupError
        ) {
          console.error(
            "Failed to release activation lock:",
            cleanupError
          );
        }
      }
    }

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

    if (
      error?.code ===
      "auth/email-already-exists"
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "An account has already been created for this registration.",
        },
        {
          status:
            409,
        }
      );
    }

    return Response.json(
      {
        success:
          false,

        message:
          "The account could not be activated. Please try again.",
      },
      {
        status:
          500,
      }
    );
  }
}