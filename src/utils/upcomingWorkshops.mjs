function dateOrdinal(input) {
  if (typeof input !== "string") return null;

  // Admin forms store YYYY-MM-DD; ISO timestamps also start with this date.
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(input);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const checked = new Date(utc);

  if (
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() !== month - 1 ||
    checked.getUTCDate() !== day
  ) return null;

  return Math.floor(utc / 86400000);
}

export function daysUntilWorkshop(startDate, today = new Date()) {
  const ordinal = dateOrdinal(startDate);
  if (ordinal === null || !(today instanceof Date) || !Number.isFinite(today.getTime())) {
    return null;
  }
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  return ordinal - Math.floor(todayUtc / 86400000);
}

export function findUpcomingAdventures(
  workshops = [],
  registrations = [],
  { today = new Date(), withinDays = 7, limit = 3 } = {}
) {
  const registeredIds = new Set(
    registrations.map((item) => item.workshopId).filter(Boolean)
  );

  return workshops
    .filter((workshop) => workshop?.status === "active")
    .filter((workshop) => !registeredIds.has(workshop.id))
    .map((workshop) => ({
      ...workshop,
      daysAway: daysUntilWorkshop(workshop.startDate, today),
    }))
    .filter((workshop) => (
      workshop.daysAway !== null &&
      workshop.daysAway >= 0 &&
      workshop.daysAway <= withinDays
    ))
    .sort((a, b) => a.daysAway - b.daysAway || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function workshopDateLabel(daysAway) {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}
