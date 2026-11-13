import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import {
  replaceCosmosDocument,
  cosmosNow,
} from "@/services/cosmosData";
import { adminAuth } from "@/services/firebaseAdmin";

export const runtime = "nodejs";

const VALID_LEARNING_MODES = [
  "in-person",
  "online",
  "both",
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

const VALID_SCHOOL_GRADES = new Set([
  "K",
  ...Array.from({ length: 12 }, (_, index) => String(index + 1)),
]);

export async function GET(
  request
) {
  try {
    const {
      uid,
      student,
    } =
      await requireActiveStudent(
        request
      );

    return Response.json({
      success:
        true,

      student: {
        id:
          uid,

        ...student,
      },
    });
  } catch (error) {
    const accessResponse =
      studentAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Load student profile error:",
      error?.message
    );

    return Response.json(
      {
        success:
          false,

        message:
          "Student profile could not be loaded.",
      },
      {
        status:
          500,
      }
    );
  }
}

export async function PATCH(
  request
) {
  try {
    const {
      uid,
      student,
    } =
      await requireActiveStudent(
        request,
        {
          consumeAppCheck:
            true,
        }
      );

    const requestBody =
      await request.json();

    const updates = {};
    // Student-owned name updates are validated on the server and mirrored to Firebase.
    const nameFieldsProvided = Object.prototype.hasOwnProperty.call(requestBody, "firstName") ||
      Object.prototype.hasOwnProperty.call(requestBody, "lastName");
    if (nameFieldsProvided) {
      const firstName = String(requestBody.firstName ?? student.firstName ?? "").trim().replace(/\s+/g, " ");
      const lastName = String(requestBody.lastName ?? student.lastName ?? "").trim().replace(/\s+/g, " ");
      const namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
      if ([firstName, lastName].some(name => name.length < 2 || name.length > 40 || !namePattern.test(name))) {
        return Response.json({ success: false, message: "Enter a valid first and last name (2–40 characters each)." }, { status: 400 });
      }
      updates.firstName = firstName;
      updates.lastName = lastName;
      updates.fullName = firstName + " " + lastName;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "schoolGrade"
      )
    ) {
      if (
        requestBody.schoolGrade !== null &&
        typeof requestBody.schoolGrade !== "string"
      ) {
        return Response.json(
          {
            success: false,
            message: "School grade is invalid.",
          },
          {
            status: 400,
          }
        );
      }

      const schoolGrade =
        requestBody.schoolGrade === null
          ? ""
          : requestBody.schoolGrade.trim();

      if (
        schoolGrade &&
        !VALID_SCHOOL_GRADES.has(schoolGrade)
      ) {
        return Response.json(
          {
            success: false,
            message: "School grade is invalid.",
          },
          {
            status: 400,
          }
        );
      }

      updates.schoolGrade = schoolGrade || null;
    }

    /*
      Learning preference is optional
      because different profile pages
      update different fields.
    */

    if (
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "learningMode"
      )
    ) {
      const learningMode =
        typeof requestBody.learningMode ===
          "string"
          ? requestBody.learningMode.trim()
          : "";

      /*
        Empty value was allowed by the
        previous client-side Firestore
        implementation, so preserve it.
      */

      if (
        learningMode &&
        !VALID_LEARNING_MODES.includes(
          learningMode
        )
      ) {
        return Response.json(
          {
            success:
              false,

            message:
              "Learning preference is invalid.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.learningMode =
        learningMode;
    }

    /*
      Interests are also optional.
    */

    if (
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "interests"
      )
    ) {
      if (
        !Array.isArray(
          requestBody.interests
        ) ||
        requestBody.interests.length >
          5
      ) {
        return Response.json(
          {
            success:
              false,

            message:
              "Interests are invalid.",
          },
          {
            status:
              400,
          }
        );
      }

      const normalizedInterests =
        requestBody.interests.map(
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
        return Response.json(
          {
            success:
              false,

            message:
              "Interests are invalid.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        new Set(
          normalizedInterests
        ).size !==
        normalizedInterests.length
      ) {
        return Response.json(
          {
            success:
              false,

            message:
              "Duplicate interests are not allowed.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.interests =
        normalizedInterests;
    }

    /*
      Used when onboarding finishes.
    */

    if (
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "onboardingCompleted"
      )
    ) {
      if (
        typeof requestBody
          .onboardingCompleted !==
        "boolean"
      ) {
        return Response.json(
          {
            success:
              false,

            message:
              "Onboarding status is invalid.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.onboardingCompleted =
        requestBody
          .onboardingCompleted;
    }

    if (
      Object.keys(
        updates
      ).length ===
      0
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "No profile changes were provided.",
        },
        {
          status:
            400,
        }
      );
    }

    updates.updatedAt = cosmosNow();

    // Firebase Auth has a display-name mirror, while Cosmos is the canonical profile.
    // If Cosmos rejects the update, best-effort restore the previous Firebase name.
    let originalDisplayName = null;
    let nameWasChangedInFirebase = false;
    if (nameFieldsProvided) {
      const firebaseUser = await adminAuth.getUser(uid);
      originalDisplayName = firebaseUser.displayName || "";
      if (originalDisplayName !== updates.fullName) {
        await adminAuth.updateUser(uid, { displayName: updates.fullName });
        nameWasChangedInFirebase = true;
      }
    }

    let updatedStudent;
    try {
      updatedStudent = await replaceCosmosDocument("students", student, updates);
    } catch (error) {
      if (nameWasChangedInFirebase) {
        try { await adminAuth.updateUser(uid, { displayName: originalDisplayName }); }
        catch (rollbackError) { console.error("Profile name mirror rollback failed:", rollbackError?.message); }
      }
      throw error;
    }

    return Response.json({
      success:
        true,

      student: {
        id:
          uid,

        ...updatedStudent,
      },
    });
  } catch (error) {
    const accessResponse =
      studentAccessResponse(
        error
      );

    if (accessResponse) {
      return accessResponse;
    }

    console.error(
      "Update student profile error:",
      error?.message
    );

    return Response.json(
      {
        success:
          false,

        message:
          "Student profile could not be updated.",
      },
      {
        status:
          500,
      }
    );
  }
}