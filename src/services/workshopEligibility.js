import { calculateAge } from "../validations/registrationSchema.js";

const GRADE_LEVELS = new Set([
  "K",
  ...Array.from({ length: 12 }, (_, index) => String(index + 1)),
]);

function getGradeBounds(workshop) {
  if (
    Number.isInteger(workshop.minGrade) ||
    Number.isInteger(workshop.maxGrade)
  ) {
    return {
      min: workshop.minGrade ?? workshop.maxGrade,
      max: workshop.maxGrade ?? workshop.minGrade,
    };
  }

  const match = String(workshop.grade || "").match(
    /grades?\s*(\d{1,2})(?:\s*(?:-|to|through|and|or|&|,)\s*(\d{1,2}))?/i
  );

  return match
    ? {
        min: Number(match[1]),
        max: Number(match[2] || match[1]),
      }
    : null;
}

function parseStudentGrade(schoolGrade) {
  if (!GRADE_LEVELS.has(schoolGrade)) {
    return null;
  }

  return schoolGrade === "K" ? 0 : Number(schoolGrade);
}

export function getWorkshopEligibility(
  workshop,
  student,
  today = new Date()
) {
  if (workshop.audience === "educators") {
    return {
      status: "ineligible",
      reason: "This opportunity is intended for educators.",
    };
  }

  const reasons = [];
  let hasCriteria = false;
  let hasUnknownCriteria = false;

  const minimumAge = Number.isInteger(workshop.minAge)
    ? workshop.minAge
    : null;
  const maximumAge = Number.isInteger(workshop.maxAge)
    ? workshop.maxAge
    : null;

  if (minimumAge !== null || maximumAge !== null) {
    hasCriteria = true;
    const age = calculateAge(student.dateOfBirth, today);

    if (age === null) {
      hasUnknownCriteria = true;
    } else if (
      (minimumAge !== null && age < minimumAge) ||
      (maximumAge !== null && age > maximumAge)
    ) {
      reasons.push("Your age is outside the stated age range.");
    }
  }

  const gradeBounds = getGradeBounds(workshop);

  if (gradeBounds) {
    hasCriteria = true;
    const grade = parseStudentGrade(student.schoolGrade);

    if (grade === null) {
      hasUnknownCriteria = true;
    } else if (grade < gradeBounds.min || grade > gradeBounds.max) {
      reasons.push("Your school grade is outside the stated grade range.");
    }
  }

  if (reasons.length > 0) {
    return {
      status: "ineligible",
      reason: reasons.join(" "),
    };
  }

  if (!hasCriteria || hasUnknownCriteria) {
    return {
      status: "unconfirmed",
      reason: "Eligibility could not be confirmed from your profile.",
    };
  }

  return {
    status: "eligible",
    reason: "Your profile matches the published eligibility criteria.",
  };
}
