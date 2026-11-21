/**
 * The staff event/reward note is optional in historical redemption records.
 * Show missing event details honestly rather than inventing an event name.
 * Only a completed redemption represents confirmed XP spending.
 */
export function studentRedemptionHistory(records = []) {
  if (!Array.isArray(records)) return [];
  return records
    .filter(record => record?.action === "xp_redemption" && record?.status === "completed")
    .map(record => {
      const points = Number(record.points);
      const date = record.completedAt || record.createdAt;
      if (!record.id || !Number.isSafeInteger(points) || points <= 0 ||
          !date || !Number.isFinite(Date.parse(date))) return null;
      return {
        id: record.id,
        date,
        event: typeof record.note === "string" && record.note.trim()
          ? record.note.trim()
          : "Event not recorded",
        xpSpent: points,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id));
}
