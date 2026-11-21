import { resolveWorkshopSessions } from "../services/workshopSessions.mjs";
import { daysUntilWorkshop } from "./upcomingWorkshops.mjs";
import { isRegistrationClosed } from "./workshopAvailability.mjs";

/**
 * Journey is future-looking: show the next active scheduled session of each
 * grade-eligible catalogue workshop, nearest date first.
 * Unlike Home's "this week" list, no arbitrary seven-day cutoff applies.
 * The authenticated workshop endpoint already restricts grade eligibility.
 */
export function findJourneyUpcomingSessions(workshops = [], { today = new Date(), limit = 6 } = {}) {
  if (!Array.isArray(workshops) || !Number.isInteger(limit) || limit < 1) return [];

  return workshops
    .filter(workshop => workshop?.status === "active" && !isRegistrationClosed(workshop))
    .map(workshop => {
      const sessions = resolveWorkshopSessions(workshop)
        .filter(session => session && (!session.status || session.status === "active"))
        .map(session => ({
          ...session,
          daysAway: daysUntilWorkshop(session.startDate, today),
        }))
        .filter(session => session.daysAway !== null && session.daysAway >= 0)
        .sort((a, b) => a.daysAway - b.daysAway ||
          String(a.startDate).localeCompare(String(b.startDate)));

      if (!sessions.length) return null;
      return {
        ...workshop,
        startDate: sessions[0].startDate,
        daysAway: sessions[0].daysAway,
        sessionId: sessions[0].id,
        learningMode: sessions[0].learningMode || workshop.learningMode,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysAway - b.daysAway ||
      String(a.startDate).localeCompare(String(b.startDate)) ||
      String(a.title).localeCompare(String(b.title)))
    .slice(0, limit);
}
