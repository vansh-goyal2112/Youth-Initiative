/**
 * Display only the reward actually configured on this workshop.
 * Missing or invalid values must not silently appear as 100 XP.
 * Award calculation and legacy migration are handled separately.
 */
export function getConfiguredWorkshopXp(workshop) {
  const raw = workshop?.xpReward;
  if (raw === null || raw === undefined || raw === "") return null;
  const amount = Number(raw);
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 100000
    ? amount
    : null;
}
