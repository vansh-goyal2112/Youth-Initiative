/** Stable Learning Journey identifiers kept for existing saved progress; no XP is granted here. */
export const QUEST_IDS = Object.freeze([
  "first-steps",
  "skill-builder",
  "curious-explorer",
  "tech-journey",
  "workshop-champion",
]);

export function isValidQuestId(id) {
  return typeof id === "string" && QUEST_IDS.includes(id);
}
