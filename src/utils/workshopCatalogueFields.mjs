import { getWorkshopGradeBounds, parseGradeRange } from "./workshopGrades.mjs";

export const workshopProgramAreas = ["Digital Youth", "Dual Credit", "Summer Camps", "School Outreach", "Youth Programs"];
export const workshopCategories = ["Technology", "Trades", "Business & Leadership", "Culinary & Hospitality", "Design & Creativity", "Health", "Aviation", "General"];
export const workshopInterests = ["Coding", "Artificial Intelligence", "Robotics", "Skilled Trades", "Business", "Design", "Health", "Aviation", "Culinary"];

export function normalizeWorkshopOption(value, options) {
  const cleaned = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return options.find(option => option.toLowerCase() === cleaned.toLowerCase()) || cleaned;
}

export function normalizeWorkshopTags(tags) {
  if (!Array.isArray(tags)) return [];
  const canonical = tags.map(tag => normalizeWorkshopOption(tag, workshopInterests));
  return [...new Set(canonical.filter(tag => workshopInterests.includes(tag)))];
}

export function workshopEditorGradeBounds(workshop) {
  const { minGrade, maxGrade } = workshop;
  if (minGrade === undefined && maxGrade === undefined) return parseGradeRange(workshop.grade);
  return Number.isInteger(minGrade) && Number.isInteger(maxGrade) &&
    minGrade >= 0 && maxGrade <= 12 && minGrade <= maxGrade
    ? { minGrade, maxGrade } : null;
}

function titleKey(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/,/g, " ").trim().replace(/\s+/g, " ");
}

export function workshopTitleGroup(workshop) {
  if (!titleKey(workshop.title) || !titleKey(workshop.programArea)) return workshop.id;
  const bounds = getWorkshopGradeBounds(workshop);
  return JSON.stringify([titleKey(workshop.title), titleKey(workshop.programArea),
    workshop.offeringYear || "", workshop.audience || "students", bounds?.minGrade ?? null, bounds?.maxGrade ?? null]);
}

export function collapseDuplicateWorkshopCards(workshops) {
  const byOffering = new Map();
  for (const workshop of workshops) {
    // Managed sessions can have distinct registration IDs and bookings.
    // Keep those records available, even when their programme titles match.
    const key = Array.isArray(workshop.sessions) && workshop.sessions.length
      ? workshop.id
      : JSON.stringify([workshopTitleGroup(workshop), workshop.startDate || "", workshop.endDate || "",
        workshop.time || "", workshop.location || "", workshop.registrationUrl || "", workshop.learningMode || "",
        workshop.availabilityStatus || "", workshop.minAge ?? null, workshop.maxAge ?? null, workshop.capacity ?? null,
        workshop.eligibilityStatus || "", workshop.informationUrl || ""]);
    const current = byOffering.get(key);
    const manual = workshop.xpRewardSource === "manual";
    const currentManual = current?.xpRewardSource === "manual";
    if (!current || (manual && !currentManual) ||
        (manual === currentManual && String(workshop.id).localeCompare(String(current.id)) < 0)) {
      byOffering.set(key, workshop);
    }
  }
  return [...byOffering.values()];
}
