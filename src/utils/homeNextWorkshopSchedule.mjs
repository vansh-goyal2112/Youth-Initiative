import { getWorkshopSchedule, workshopDateRange } from "./workshopDate.mjs";

// Home must display the session the student registered for, not another
// active session or a stale parent date.
const emptySchedule = () => ({ startDate: null, endDate: null, time: "" });

function datedSchedule(source) {
  if (!source || !workshopDateRange(source)) return null;
  return {
    startDate: source.startDate,
    endDate: source.endDate || null,
    time: source.time || "",
  };
}

export function getHomeRegisteredSchedule(registration) {
  const workshop = registration?.workshop || {};
  const sessions = Array.isArray(workshop.sessions) ? workshop.sessions : [];
  const sessionId = registration?.sessionId;

  if (sessionId) {
    const current = sessions.find(session => session?.id === sessionId);
    const saved = registration?.sessionSnapshot;
    // A removed or archived session is still shown from the original booking.
    return datedSchedule(current)
      || datedSchedule(saved && (!saved.id || saved.id === sessionId) ? saved : null)
      || emptySchedule();
  }

  // Backfilled registrations can carry a snapshot but no session identifier.
  const saved = datedSchedule(registration?.sessionSnapshot);
  if (saved) return saved;

  // Without a registered session, showing the next *different* session is misleading.
  if (sessions.length > 0) return emptySchedule();

  return getWorkshopSchedule(workshop);
}

export function getHomeWorkshopDateLabel(registration) {
  return workshopDateRange(getHomeRegisteredSchedule(registration));
}
