// Admin-configurable badge rules are declarative, never executable code.
// Counts each completed workshop registration/session once, including self-reports.
const TYPES = new Set(["sessions_any", "sessions_topic", "sessions_program_area"]);

export function validateBadgeDefinition(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Badge data is required.");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const artworkUrl = typeof input.artworkUrl === "string" ? input.artworkUrl.trim() : "";
  if (name.length < 3 || name.length > 80 || description.length > 250) {
    throw new Error("Enter a badge name of 3–80 characters and a short description.");
  }
  if (artworkUrl) {
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
  if (type !== "sessions_any" && (matchValue.length < 2 || matchValue.length > 80)) {
    throw new Error("Enter a program area or workshop topic for the badge rule.");
  }
  const status = input.status || "active";
  if (!["active", "archived"].includes(status)) throw new Error("Badge status is invalid.");
  return { name, description, artworkUrl, status, rule: { type, minCount, matchValue } };
}

export function countMatchingSessions(rule, registrations) {
  const target = String(rule?.matchValue || "").trim().toLowerCase();
  const registrationsArray = Array.isArray(registrations) ? registrations : [];
  return registrationsArray.filter(record => {
    if (record.status !== "completed") return false;
    const snapshot = record.workshopSnapshot || {};
    if (rule.type === "sessions_any") return true;
    if (rule.type === "sessions_program_area") return String(snapshot.programArea || "").toLowerCase() === target;
    if (rule.type === "sessions_topic") return [snapshot.title, snapshot.category, snapshot.programArea]
      .some(value => String(value || "").toLowerCase().includes(target));
    return false;
  }).length;
}
