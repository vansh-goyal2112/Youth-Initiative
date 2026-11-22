import { getWorkshopGradeBounds } from "./workshopGrades.mjs";
import { normalizeWorkshopTags, workshopTitleGroup } from "./workshopCatalogueFields.mjs";

const listingFields = [
  "category", "description", "informationUrl", "registrationUrl", "startDate", "endDate",
  "time", "location", "learningMode", "capacity", "minAge", "maxAge", "availabilityStatus",
  "registrationStatus", "registrationClosed", "offeringType", "registrationType",
];

export function checkWorkshopDuplicate(keep, duplicate) {
  if (!keep || !duplicate || !keep.id || keep.id === duplicate.id ||
      keep.duplicateOf || duplicate.duplicateOf || keep.status !== "active" || duplicate.status !== "active") {
    return "Choose two different active experience records.";
  }
  if (workshopTitleGroup(keep) !== workshopTitleGroup(duplicate) ||
      !getWorkshopGradeBounds(keep) || !getWorkshopGradeBounds(duplicate)) {
    return "The titles, program areas, offering years, audience and grade ranges must match.";
  }
  if (keep.sessions?.length || duplicate.sessions?.length) return "At least one record has scheduled sessions. Review this pair manually.";
  if (listingFields.some(key => (keep[key] ?? "") !== (duplicate[key] ?? "")) ||
      JSON.stringify(normalizeWorkshopTags(keep.interestTags).sort()) !==
      JSON.stringify(normalizeWorkshopTags(duplicate.interestTags).sort())) {
    return "The experience details differ. Review both records before consolidating.";
  }
  if (!Number.isSafeInteger(keep.xpReward) || keep.xpReward !== duplicate.xpReward) {
    return "The XP rewards must match before these records can be consolidated.";
  }
  if (duplicate.imageStatus === "custom" && duplicate.image !== keep.image) {
    return "The duplicate has a different custom image. Review which record should be kept.";
  }
  return null;
}
