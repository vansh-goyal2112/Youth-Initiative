import {
  adminAuth,
} from "@/services/firebaseAdmin";

import {
  adminAccessResponse,
  requireAdminPermission,
} from "@/services/adminAccess";

import {
  cosmosNow,
  queryCosmosDocuments,
  readCosmosDocument,
  replaceCosmosDocument,
} from "@/services/cosmosData";

export const runtime = "nodejs";

const VALID_LEARNING_MODES = [
  "in-person",
  "online",
  "both",
];

const VALID_ACCOUNT_STATUSES = [
  "active",
  "inactive",
];

const VALID_INTERESTS = [
  "coding",
  "artificial intelligence",
  "robotics",
  "skilled trades",
  "business",
  "design",
  "health",
  "aviation",
  "culinary",
];

const NAME_REGEX =
  /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function apiError(
  message,
  status
) {
  const error =
    new Error(
      message
    );

  error.status =
    status;

  return error;
}

function customErrorResponse(
  error
) {
  if (
    [
      400,
      404,
      409,
    ].includes(
      error?.status
    )
  ) {
    return Response.json(
      {
        success:
          false,

        message:
          error.message,
      },
      {
        status:
          error.status,
      }
    );
  }

  return null;
}

function normalizeName(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

function validateStudentUpdate(
  data
) {
  const firstName =
    normalizeName(
      data.firstName
    );

  const lastName =
    normalizeName(
      data.lastName
    );

  const contactEmail =
    String(
      data.contactEmail ||
      ""
    )
      .trim()
      .toLowerCase();

  const learningMode =
    data.learningMode
      ? String(
          data.learningMode
        ).trim()
      : null;

  const accountStatus =
    String(
      data.accountStatus ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    firstName.length < 2 ||
    firstName.length > 40 ||
    !NAME_REGEX.test(
      firstName
    )
  ) {
    throw apiError(
      "First name is invalid.",
      400
    );
  }

  if (
    lastName.length < 2 ||
    lastName.length > 40 ||
    !NAME_REGEX.test(
      lastName
    )
  ) {
    throw apiError(
      "Last name is invalid.",
      400
    );
  }

  if (
    contactEmail.length >
      254 ||
    !EMAIL_REGEX.test(
      contactEmail
    )
  ) {
    throw apiError(
      "Contact email is invalid.",
      400
    );
  }

  if (
    learningMode !==
      null &&
    !VALID_LEARNING_MODES.includes(
      learningMode
    )
  ) {
    throw apiError(
      "Learning mode is invalid.",
      400
    );
  }

  if (
    !VALID_ACCOUNT_STATUSES.includes(
      accountStatus
    )
  ) {
    throw apiError(
      "Account status is invalid.",
      400
    );
  }

  if (
    !Array.isArray(
      data.interests
    )
  ) {
    throw apiError(
      "Student interests are invalid.",
      400
    );
  }

  if (
    data.interests.length >
    5
  ) {
    throw apiError(
      "A student can have a maximum of 5 interests.",
      400
    );
  }

  const normalizedInterests =
    data.interests.map(
      (interest) =>
        String(
          interest
        )
          .trim()
          .toLowerCase()
    );

  if (
    normalizedInterests.some(
      (interest) =>
        !VALID_INTERESTS.includes(
          interest
        )
    )
  ) {
    throw apiError(
      "One or more student interests are invalid.",
      400
    );
  }

  if (
    new Set(
      normalizedInterests
    ).size !==
    normalizedInterests.length
  ) {
    throw apiError(
      "Duplicate interests are not allowed.",
      400
    );
  }

  return {
    firstName,

    lastName,

    contactEmail,

    learningMode,

    interests:
      normalizedInterests,

    accountStatus,
  };
}

async function getStudentAndAuthUser(
  studentId
) {
  const student =
    await readCosmosDocument(
      "students",
      studentId
    );

  if (
    !student
  ) {
    throw apiError(
      "Student not found.",
      404
    );
  }

  /*
    A document in this container must
    represent a student account.
  */

  if (
    student.role &&
    student.role !==
      "student"
  ) {
    throw apiError(
      "This account is not a student account.",
      409
    );
  }

  /*
    Student document ID should be the
    Firebase Authentication UID.

    If firebaseUid is stored, it must match.
  */

  if (
    student.firebaseUid &&
    student.firebaseUid !==
      studentId
  ) {
    throw apiError(
      "Student authentication information is inconsistent.",
      409
    );
  }

  let authUser;

  try {
    authUser =
      await adminAuth.getUser(
        studentId
      );
  } catch (
    error
  ) {
    if (
      error?.code ===
      "auth/user-not-found"
    ) {
      throw apiError(
        "The Firebase account for this student could not be found.",
        409
      );
    }

    throw error;
  }

  return {
    student,
    authUser,
  };
}


/*
  ========================================
  GET STUDENTS
  ========================================
*/

export async function GET(
  request
) {
  try {
    await requireAdminPermission(request, "students.view");

    const studentDocuments =
      await queryCosmosDocuments(
        "students",
        `
          SELECT *
          FROM c
        `
      );

    const students =
      studentDocuments
        // Explicit allowlist: never expose guardian verification tokens,
        // authentication metadata, recovery hashes, or internal records.
        .map((student) => ({
          id: student.id,
          youthId: student.youthId,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: student.fullName,
          contactEmail: student.contactEmail,
          dateOfBirth: student.dateOfBirth,
          learningMode: student.learningMode,
          interests: student.interests || [],
          totalXp: student.totalXp || 0,
          level: student.level || 1,
          badgeCount: student.badgeCount || 0,
          completedWorkshopCount: student.completedWorkshopCount || 0,
          accountStatus: student.accountStatus,
          createdAt: student.createdAt,
        }))
        .sort(
          (
            firstStudent,
            secondStudent
          ) =>
            String(
              firstStudent
                .firstName ||
              ""
            ).localeCompare(
              String(
                secondStudent
                  .firstName ||
                ""
              )
            )
        );

    return Response.json({
      success:
        true,

      students,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (
    error
  ) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (
      accessResponse
    ) {
      return accessResponse;
    }

    console.error(
      "Admin load students error:",
      error?.message
    );

    return Response.json(
      {
        success:
          false,

        message:
          "Students could not be loaded.",
      },
      {
        status:
          500,
      }
    );
  }
}


/*
  ========================================
  UPDATE STUDENT
  ========================================
*/

export async function PUT(
  request
) {
  let authStateChanged =
    false;

  let previousDisabledState =
    null;

  let targetStudentId =
    null;

  try {
    const admin =
      await requireAdminPermission(request, "students.edit");

    const requestBody =
      await request.json();

    targetStudentId =
      typeof requestBody.id ===
        "string"
        ? requestBody.id.trim()
        : "";

    if (
      !targetStudentId
    ) {
      throw apiError(
        "Student ID is required.",
        400
      );
    }

    const validatedData =
      validateStudentUpdate(
        requestBody
      );

    const {
      student,
      authUser,
    } =
      await getStudentAndAuthUser(
        targetStudentId
      );

    /*
      Keep Firebase Authentication's
      disabled state synchronized with
      Cosmos accountStatus.
    */

    const desiredDisabledState =
      validatedData
        .accountStatus ===
      "inactive";

    previousDisabledState =
      authUser.disabled;

    // Student data is canonical in Cosmos. Only Firebase displayName mirrors
    // the profile name; the Firebase login email is an internal Youth ID and
    // must NOT be replaced with the parent/student contact email.
    const displayName = validatedData.firstName + " " + validatedData.lastName;
    const previousDisplayName = authUser.displayName || "";
    const displayNameChanged = previousDisplayName !== displayName;

    const duplicateEmail = await queryCosmosDocuments(
      "students",
      "SELECT TOP 1 c.id FROM c WHERE c.contactEmail = @email AND c.id != @id",
      [
        { name: "@email", value: validatedData.contactEmail },
        { name: "@id", value: targetStudentId },
      ]
    );
    if (duplicateEmail.length) {
      throw apiError("Another student already uses this contact email.", 409);
    }

    try {
      if (displayNameChanged) {
        await adminAuth.updateUser(targetStudentId, { displayName });
      }
      if (authUser.disabled !== desiredDisabledState) {
        await adminAuth.updateUser(targetStudentId, { disabled: desiredDisabledState });
        authStateChanged = true;
      }
    } catch (firebaseError) {
      if (displayNameChanged) {
        try {
          await adminAuth.updateUser(targetStudentId, { displayName: previousDisplayName });
        } catch (rollbackError) {
          console.error("Firebase display name rollback failed:", rollbackError?.message);
        }
      }
      throw firebaseError;
    }

    /*
      If account is being disabled,
      revoke existing refresh tokens.

      This forces old sessions to
      authenticate again.
    */

    if (
      desiredDisabledState
    ) {
      try {
        await adminAuth
          .revokeRefreshTokens(
            targetStudentId
          );
      } catch (
        revokeError
      ) {
        console.error(
          "Student token revocation error:",
          revokeError?.message
        );

        /*
          The Auth account is already
          disabled, so continue writing
          the inactive state to Cosmos.
        */
      }
    }

    try {
      const updatedAt =
        cosmosNow();

      await replaceCosmosDocument(
        "students",
        student,
        {
          firstName:
            validatedData
              .firstName,

          lastName:
            validatedData
              .lastName,

          fullName:
            `${validatedData.firstName} ${validatedData.lastName}`,

          contactEmail:
            validatedData
              .contactEmail,

          learningMode:
            validatedData
              .learningMode,

          interests:
            validatedData
              .interests,

          accountStatus:
            validatedData
              .accountStatus,

          updatedBy:
            admin.uid,

          updatedAt,

          accountStatusUpdatedAt:
            updatedAt,
        }
      );
    } catch (
      cosmosError
    ) {
      /*
        Firebase Auth and Cosmos DB cannot
        participate in one atomic transaction.

        If Cosmos fails after we changed
        Firebase's disabled state, attempt to
        restore the previous Auth state.
      */

      if (authStateChanged || displayNameChanged) {
        try {
          await adminAuth.updateUser(targetStudentId, {
            ...(authStateChanged ? { disabled: previousDisabledState } : {}),
            ...(displayNameChanged ? { displayName: previousDisplayName } : {}),
          });
        } catch (rollbackError) {
          console.error("Student Firebase rollback failed:", rollbackError?.message);
        }
      }

      throw cosmosError;
    }

    return Response.json({
      success:
        true,

      message:
        validatedData
          .accountStatus ===
        "inactive"
          ? "Student updated and account deactivated successfully."
          : "Student updated successfully.",
    });
  } catch (
    error
  ) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (
      accessResponse
    ) {
      return accessResponse;
    }

    const customResponse =
      customErrorResponse(
        error
      );

    if (
      customResponse
    ) {
      return customResponse;
    }

    console.error(
      "Admin update student error:",
      error?.message
    );

    return Response.json(
      {
        success:
          false,

        message:
          "Student could not be updated.",
      },
      {
        status:
          500,
      }
    );
  }
}


/*
  ========================================
  DEACTIVATE STUDENT
  ========================================

  DELETE here means deactivate.

  We do NOT delete the student document
  or Firebase Authentication account.
*/

export async function DELETE(
  request
) {
  let previousDisabledState =
    null;

  let authenticationChanged =
    false;

  let targetStudentId =
    null;

  try {
    const admin =
      await requireAdminPermission(request, "students.deactivate");

    const requestBody =
      await request.json();

    targetStudentId =
      typeof requestBody.id ===
        "string"
        ? requestBody.id.trim()
        : "";

    if (
      !targetStudentId
    ) {
      throw apiError(
        "Student ID is required.",
        400
      );
    }

    const {
      student,
      authUser,
    } =
      await getStudentAndAuthUser(
        targetStudentId
      );

    previousDisabledState =
      authUser.disabled;

    /*
      Disable Firebase Authentication
      before changing Cosmos DB.

      This fails closed:
      the user cannot continue signing in
      if a later database operation fails.
    */

    if (
      !authUser.disabled
    ) {
      await adminAuth.updateUser(
        targetStudentId,
        {
          disabled:
            true,
        }
      );

      authenticationChanged =
        true;
    }

    /*
      Revoke existing sessions.

      Do not expose revocation errors to
      the browser, but record them.
    */

    try {
      await adminAuth
        .revokeRefreshTokens(
          targetStudentId
        );
    } catch (
      revokeError
    ) {
      console.error(
        "Student token revocation error:",
        revokeError?.message
      );
    }

    try {
      const deactivatedAt =
        cosmosNow();

      await replaceCosmosDocument(
        "students",
        student,
        {
          accountStatus:
            "inactive",

          deactivatedBy:
            admin.uid,

          deactivatedAt,

          updatedAt:
            deactivatedAt,
        }
      );
    } catch (
      cosmosError
    ) {
      /*
        Attempt rollback only when this
        request changed Firebase Auth.

        Token revocation remains in place;
        the student can sign in again after
        reactivation if rollback succeeds.
      */

      if (
        authenticationChanged
      ) {
        try {
          await adminAuth.updateUser(
            targetStudentId,
            {
              disabled:
                previousDisabledState,
            }
          );
        } catch (
          rollbackError
        ) {
          console.error(
            "Student Auth rollback failed:",
            rollbackError?.message
          );
        }
      }

      throw cosmosError;
    }

    return Response.json({
      success:
        true,

      message:
        "Student account deactivated successfully.",
    });
  } catch (
    error
  ) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (
      accessResponse
    ) {
      return accessResponse;
    }

    const customResponse =
      customErrorResponse(
        error
      );

    if (
      customResponse
    ) {
      return customResponse;
    }

    console.error(
      "Admin deactivate student error:",
      error?.message
    );

    return Response.json(
      {
        success:
          false,

        message:
          "Student could not be deactivated.",
      },
      {
        status:
          500,
      }
    );
  }
}