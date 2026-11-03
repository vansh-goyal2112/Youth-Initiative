/**
 * Small, age-friendly engagement activities. These are not XP grants:
 * earned XP still depends on verified attendance and the XP ledger.
 */
export const QUEST_IDS = Object.freeze([
  "first-steps",
  "skill-builder",
  "curious-explorer",
  "tech-journey",
  "workshop-champion",
]);

export const REFLECTION_MOODS = Object.freeze([
  { id: "proud", label: "Proud of myself", emoji: "🌟" },
  { id: "curious", label: "Curious for more", emoji: "🔎" },
  { id: "challenged", label: "I learned through a challenge", emoji: "💪" },
  { id: "inspired", label: "Inspired to try again", emoji: "🚀" },
]);

export const LEARNING_MOMENTS = Object.freeze([
  { id: "tried", label: "I tried something new" },
  { id: "created", label: "I made or built something" },
  { id: "solved", label: "I solved a problem" },
  { id: "teamwork", label: "I worked with others" },
]);

export function isValidQuestId(id) {
  return typeof id === "string" && QUEST_IDS.includes(id);
}

export function validateReflection({ mood, moment } = {}) {
  return (
    REFLECTION_MOODS.some((option) => option.id === mood) &&
    LEARNING_MOMENTS.some((option) => option.id === moment)
  );
}

export function getReflectionStats(registrations = []) {
  const verified = registrations.filter((item) =>
    item?.status === "completed" &&
    item?.attendanceStatus === "verified" &&
    item.workshopId
  );
  const reflected = verified.filter((item) => Boolean(item.reflection?.completedAt));
  const pending = verified
    .filter((item) => !item.reflection?.completedAt)
    .sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));

  return {
    completedCount: verified.length,
    reflectedCount: reflected.length,
    pending,
    recent: reflected
      .slice()
      .sort((a, b) =>
        String(b.reflection.completedAt).localeCompare(
          String(a.reflection.completedAt)
        )
      )
      .slice(0, 3),
  };
}
