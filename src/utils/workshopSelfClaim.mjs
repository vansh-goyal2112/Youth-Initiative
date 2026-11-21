import { getWorkshopGradeBounds, schoolGradeNumber } from "./workshopGrades.mjs";

/**
 * Self-claims are for genuine past attendance, not new registration.
 * School outreach can be delivered via a school without an individual
 * online signup, and some legacy outreach records have no grade bounds.
 */
export function isSchoolOutreachWorkshop(workshop = {}) {
  if (workshop?.outreach === true) return true;
  const description = [
    workshop?.title,
    workshop?.programArea,
    workshop?.category,
  ].filter(value => typeof value === "string").join(" ");
  return /\boutreach\b|\bschool[\s-]?(?:visits?|field[\s-]?trips?)\b|\bfield[\s-]?trips?\b|\b(?:1|one)[\s-]?day\b.{0,45}\bon[\s-]?campus\b|\bon[\s-]?campus\b.{0,40}\bactivit(?:y|ies)\b/i.test(description);
}

/**
 * Students may self-claim a workshop from their current or any earlier
 * grade. A workshop whose minimum grade is in the future is excluded.
 * Only identifiable school outreach is offered if its grade is unpublished.
 * This must never be reused for new registrations or recommendations.
 */
export function getSelfClaimCategory(workshop, schoolGrade) {
  const grade = schoolGradeNumber(schoolGrade);
  if (grade === null || !workshop || workshop.audience === "educators" ||
      workshop.status === "deleted") return null;
  const bounds = getWorkshopGradeBounds(workshop);
  if (bounds && bounds.minGrade > grade) return null;
  if (isSchoolOutreachWorkshop(workshop)) return "outreach";
  if (!bounds) return null;
  return bounds.maxGrade < grade ? "earlier" : "current";
}
