import { calculateAge } from "../validations/registrationSchema.js";

const GRADE_LEVELS = new Set([
  "K",
  ...Array.from({ length: 12 }, (_, index) => String(index + 1)),
]);

function getGradeBounds(workshop) {
  if (Number.isInteger(workshop.minGrade) || Number.isInteger(workshop.maxGrade)) {
    return {
      min: workshop.minGrade ?? workshop.maxGrade,
      max: workshop.maxGrade ?? workshop.minGrade,
    };
  }

  // SAIT catalogue grades can be "Grade 6", "Grades 6–9", "K-6" or "6 to 12".
  // Never infer grade eligibility from a bare unrelated number in the title.
  const value = String(workshop.grade || "").trim().replace(/[–—]/g, "-");
  const tokenToGrade = token => /^k$/i.test(token) ? 0 : Number(token);
  const range = value.match(/^(?:grades?\s*)?(K|\d{1,2})\s*(?:-|to|through|and|&)\s*(?:grades?\s*)?(K|\d{1,2})\b/i);
  if (range) {
    const first = tokenToGrade(range[1]);
    const last = tokenToGrade(range[2]);
    return first <= last && last <= 12 ? { min: first, max: last } : null;
  }
  const single = value.match(/^(?:grades?\s*)?(K|\d{1,2})\b$/i);
  if (single) {
    const grade = tokenToGrade(single[1]);
    return grade <= 12 ? { min: grade, max: grade } : null;
  }
  return null;
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
