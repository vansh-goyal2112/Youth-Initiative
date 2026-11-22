// Stable award identity prevents duplicate payment for a workshop or session.
// Existing QR records without scheduled sessions retain their historical IDs.
export function completionTransactionId(studentId, workshopId, sessionId = null) {
  if (!studentId || !workshopId) throw new Error("Student and experience IDs are required.");
  return sessionId
    ? studentId + "_" + workshopId + "_session_" + sessionId
    : studentId + "_" + workshopId;
}

export function awardForCompletion(workshop, method = "qr") {
  const missing = workshop?.xpReward === undefined || workshop?.xpReward === null;
  const raw = missing ? 100 : Number(workshop.xpReward);
  if (!Number.isSafeInteger(raw) || raw <= 0) {
    throw new RangeError("Experience XP must be a positive whole number.");
  }
  const base = raw;
  if (method === "qr") return base;
  if (method === "self_reported") return Math.max(1, Math.floor(base / 2));
  throw new Error("Unknown experience completion method.");
}
