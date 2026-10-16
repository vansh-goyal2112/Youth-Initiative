/**
 * Presentation-only helpers for the authenticated student profile.
 * The account ID and contact address are stored on the Cosmos "students"
 * document, not on the Firebase synthetic sign-in email.
 */
function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function studentYouthId(student) {
  return cleanString(student?.youthId) || null;
}

export function studentContactEmail(student) {
  const candidate = cleanString(student?.contactEmail) || cleanString(student?.email);
  if (!candidate || !candidate.includes("@")) return null;
  // Youth ID sign-in uses a synthetic internal Firebase email.
  if (candidate.toLowerCase().endsWith("@youthinitiative.local")) return null;
  return candidate;
}

export function studentDisplayName(student) {
  return cleanString(student?.fullName) ||
    [cleanString(student?.firstName), cleanString(student?.lastName)]
      .filter(Boolean)
      .join(" ") ||
    "Young Explorer";
}

export function studentInitials(student) {
  const first = cleanString(student?.firstName);
  const last = cleanString(student?.lastName);
  if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return studentDisplayName(student)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "YI";
}

export function formatStudentBirthDate(value) {
  const text = cleanString(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatLearningPreference(mode) {
  const names = { "in-person": "In person", online: "Online", both: "Online & in person" };
  return names[mode] || "Not selected yet";
}

export function formatStudentInterest(interest) {
  return cleanString(interest)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function finiteCount(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export function profileProgress(student, gamification) {
  return {
    totalXp: finiteCount(gamification?.totalXp ?? student?.totalXp),
    level: Math.max(1, finiteCount(gamification?.level ?? student?.level, 1)),
    badges: finiteCount(gamification?.badgeCount ?? student?.badgeCount),
    completed: finiteCount(gamification?.completedWorkshops ?? student?.completedWorkshopCount),
    nextLevelXp: gamification?.nextLevelXp ?? null,
    progressPercentage: Math.min(100, finiteCount(gamification?.progressPercentage ?? 0)),
    rank: cleanString(gamification?.rank || student?.levelName) || "New Explorer",
  };
}

export function studentInterests(student) {
  return Array.isArray(student?.interests)
    ? student.interests.filter((value) => cleanString(value))
    : [];
}
