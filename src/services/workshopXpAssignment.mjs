// Deterministic variety: the same workshop ID receives the same XP across
// imports, restarts and devices. Store this value on each workshop document.
export const WORKSHOP_XP_OPTIONS = Object.freeze([50, 75, 100, 125, 150, 175, 200]);

export function automaticWorkshopXp(workshopId) {
  const input = String(workshopId || "");
  if (!input) throw new Error("Experience ID is required to assign XP.");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return WORKSHOP_XP_OPTIONS[(hash >>> 0) % WORKSHOP_XP_OPTIONS.length];
}

// Older SAIT imports were assigned 100 XP automatically. Do not touch
// workshops staff have edited or that have an explicit reward source.
export function needsLegacyXpAssignment(workshop) {
  if (!workshop || workshop.xpRewardSource || workshop.updatedBy) return false;
  if (workshop.importedFromExcel !== true && workshop.importedFromExcel !== false) return false;
  return workshop.xpReward == null || Number(workshop.xpReward) === 100;
}
