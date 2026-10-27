import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import {
  replaceCosmosDocument,
} from "@/services/cosmosData";

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

    const updatedStudent =
      await replaceCosmosDocument(
        "students",
        student,
        updates
      );

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