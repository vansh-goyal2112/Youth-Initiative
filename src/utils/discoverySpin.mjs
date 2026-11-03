import { daysUntilWorkshop } from "./upcomingWorkshops.mjs";

export function getDiscoverableWorkshops(
  workshops = [],
  registrations = [],
  today = new Date()
) {
  const registeredIds = new Set(
    registrations.map((registration) => registration?.workshopId).filter(Boolean)
  );

  return workshops.filter((workshop) => {
    if (!workshop?.id || workshop.status !== "active" || registeredIds.has(workshop.id)) {
      return false;
    }
    const daysAway = daysUntilWorkshop(workshop.startDate, today);
    return daysAway === null || daysAway >= 0;
  });
}

export function chooseDiscovery(workshops = [], currentId = null, random = Math.random) {
  if (!workshops.length) return null;
  const otherChoices = workshops.filter((workshop) => workshop.id !== currentId);
  const candidates = otherChoices.length ? otherChoices : workshops;
  const sampled = Number(random());
  const safeRandom = Number.isFinite(sampled) ? Math.min(0.999999, Math.max(0, sampled)) : 0;
  return candidates[Math.floor(safeRandom * candidates.length)];
}
