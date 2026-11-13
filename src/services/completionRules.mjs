// Stable award identity prevents duplicate payment for a workshop or session.
// Existing QR records without scheduled sessions retain their historical IDs.
export function completionTransactionId(studentId, workshopId, sessionId = null) {
  if (!studentId || !workshopId) throw new Error("Student and workshop IDs are required.");
  return sessionId
    ? studentId + "_" + workshopId + "_session_" + sessionId
    : studentId + "_" + workshopId;
}

export function awardForCompletion(workshop, method = "qr") {
  const raw = Number(workshop?.xpReward);
  const base = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 100;
  if (method === "qr") return base;
  if (method === "self_reported") return Math.max(1, Math.floor(base / 2));
  throw new Error("Unknown workshop completion method.");
}
