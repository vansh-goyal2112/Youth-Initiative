/** A calendar date is formatted in UTC, so YYYY-MM-DD never shifts a day. */
export function formatWorkshopDate(value) {
  let date;
  if (value instanceof Date) {
    date = value;
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(String(value || ""));
    if (!match) return "";
    date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (date.getUTCFullYear() !== Number(match[1]) ||
        date.getUTCMonth() + 1 !== Number(match[2]) ||
        date.getUTCDate() !== Number(match[3])) return "";
  }
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", year:"numeric", timeZone:"UTC" }).format(date);
}

/** Prefer the chosen session, then the earliest upcoming active session. */
export function getWorkshopSchedule(workshop = {}, sessionId = null, today = new Date()) {
  const hasSessionRecords = Array.isArray(workshop.sessions) && workshop.sessions.length > 0;
  const sessions = hasSessionRecords ? workshop.sessions
    .filter(item => item && (item.status === "active" || !item.status) && formatWorkshopDate(item.startDate))
    .sort((a,b) => String(a.startDate).localeCompare(String(b.startDate))) : [];
  // A registered student's original session date remains visible even if the
  // session is later archived. Unselected catalogue cards still use active sessions.
  const selected = sessionId && hasSessionRecords
    ? workshop.sessions.find(item => item?.id === sessionId && formatWorkshopDate(item.startDate)) || null
    : null;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const next = selected || sessions.find(item => item.startDate >= todayKey) || sessions[0] || null;
  return {
    // Once sessions are explicitly managed, never display a stale parent
    // date from an archived session or another active session's end date.
    startDate: next?.startDate || (hasSessionRecords ? null : workshop.startDate || null),
    endDate: next ? (next.endDate || null) : (hasSessionRecords ? null : workshop.endDate || null),
    time: next ? (next.time || "") : (hasSessionRecords ? "" : workshop.time || ""),
  };
}

export function workshopDateRange(schedule) {
  const start = formatWorkshopDate(schedule?.startDate);
  if (!start) return "";
  const end = formatWorkshopDate(schedule?.endDate);
  return end && end !== start ? `${start} – ${end}` : start;
}
