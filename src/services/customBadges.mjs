import { artworkIdFromPath } from "../utils/mediaArtwork.mjs";

// Admin-configurable badge rules are declarative, never executable code.
// Counts each completed workshop registration/session once, including self-reports.
const MATCH_RULES = new Set(["sessions_topic", "sessions_program_area", "sessions_category"]);
const TYPES = new Set(["sessions_any", "distinct_categories", ...MATCH_RULES]);

export const BUILT_IN_BADGES = [
  ["first-step", "First Step", "Complete your first experience.", "sessions_any", 1],
  ["tech-explorer", "Tech Explorer", "Complete a Technology experience.", "sessions_category", 1, "Technology"],
  ["skill-builder", "Skill Builder", "Complete 3 experiences.", "sessions_any", 3],
  ["curious-learner", "Curious Learner", "Explore 3 different skill areas.", "distinct_categories", 3],
  ["workshop-champion", "Experience Champion", "Complete 5 experiences.", "sessions_any", 5],
].map(([badgeId, name, description, type, minCount, matchValue = ""]) => ({
  id: "badge-def:" + badgeId, badgeId, name, description,
  status: "active", artworkUrl: "", rule: { type, minCount, matchValue },
}));

export function currentBadgeName(badgeId, name) {
  return badgeId === "workshop-champion" && name === "Workshop Champion" ? "Experience Champion" : name;
}

export function mergeBadgeDefinitions(savedDefinitions) {
  const byId = new Map(savedDefinitions.map(definition => [definition.id, definition]));
  const builtIns = BUILT_IN_BADGES.map(defaultBadge => {
    const saved = byId.get(defaultBadge.id);
    byId.delete(defaultBadge.id);
    return { ...defaultBadge, ...saved, name: currentBadgeName(defaultBadge.badgeId, saved?.name ?? defaultBadge.name), badgeId: defaultBadge.badgeId, builtIn: true };
  });
  return [...builtIns, ...byId.values()];
}

export function validateBadgeDefinition(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Badge data is required.");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const artworkUrl = typeof input.artworkUrl === "string" ? input.artworkUrl.trim() : "";
  if (name.length < 3 || name.length > 80 || description.length > 250) {
    throw new Error("Enter a badge name of 3–80 characters and a short description.");
  }
  if (artworkUrl && !artworkIdFromPath(artworkUrl)) {
    let url;
    try { url = new URL(artworkUrl); } catch { throw new Error("Badge image URL is invalid."); }
    if (url.protocol !== "https:" || url.username || url.password || artworkUrl.length > 500) {
      throw new Error("Badge artwork must be a safe HTTPS image URL.");
    }
  }
  const type = input.rule?.type;
  const minCount = Number(input.rule?.minCount);
  const matchValue = typeof input.rule?.matchValue === "string" ? input.rule.matchValue.trim() : "";
  if (!TYPES.has(type) || !Number.isSafeInteger(minCount) || minCount < 1 || minCount > 50) {
    throw new Error("Badge rule must specify a valid condition and a target of 1–50 completed sessions.");
  }
  if (MATCH_RULES.has(type) && (matchValue.length < 2 || matchValue.length > 80)) {
    throw new Error("Enter a category, program area or experience topic for the badge rule.");
  }
  const status = input.status || "active";
  if (!["active", "archived"].includes(status)) throw new Error("Badge status is invalid.");
  return { name, description, artworkUrl, status, rule: { type, minCount, matchValue } };
}

export function countMatchingSessions(rule, registrations) {
  const target = String(rule?.matchValue || "").trim().toLowerCase();
  const completed = (Array.isArray(registrations) ? registrations : [])
    .filter(record => record.status === "completed");
  if (rule.type === "sessions_any") return completed.length;
  if (rule.type === "distinct_categories") {
    return new Set(completed.map(record => record.workshopSnapshot?.category).filter(Boolean)).size;
  }
  return completed.filter(record => {
    const snapshot = record.workshopSnapshot || {};
    if (rule.type === "sessions_category") return String(snapshot.category || "").toLowerCase() === target;
    if (rule.type === "sessions_program_area") return String(snapshot.programArea || "").toLowerCase() === target;
    if (rule.type === "sessions_topic") return [snapshot.title, snapshot.category, snapshot.programArea]
      .some(value => String(value || "").toLowerCase().includes(target));
    return false;
  }).length;
}

/**
 * Only active rule-driven badges can become unearned after a completion reversal.
 * Keep an existing metadata-based badge when older workshop metadata is missing,
 * rather than revoking a valid achievement based on incomplete history.
 */
export function findUnmetBadgeIds(definitions, registrations, reversedCompletion) {
  const completed = (Array.isArray(registrations) ? registrations : [])
    .filter(record => record.status === "completed");
  const hasUnknownWorkshop = completed.some(record => !record.workshopSnapshot);
  return (Array.isArray(definitions) ? definitions : [])
    .filter(definition => definition.status === "active" &&
      (definition.builtIn || definition.badgeId?.startsWith("custom:")) &&
      definition.rule && Number.isSafeInteger(Number(definition.rule.minCount)) &&
      Number(definition.rule.minCount) > 0 &&
      !(hasUnknownWorkshop && definition.rule.type !== "sessions_any") &&
      countMatchingSessions(definition.rule, completed) < Number(definition.rule.minCount) &&
      // A reversal must cross the current threshold for an edited built-in badge.
      (!definition.builtIn || !definition.updatedAt || (reversedCompletion &&
        countMatchingSessions(definition.rule, [...completed, reversedCompletion]) >= Number(definition.rule.minCount))))
    .map(definition => definition.badgeId);
}
