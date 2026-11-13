// Scheduled sessions are embedded in the existing workshop record.
// Legacy single-date workshops retain a virtual session until first edited.
export function resolveWorkshopSessions(workshop = {}) {
  if (Array.isArray(workshop.sessions) && workshop.sessions.length) {
    return workshop.sessions;
  }
  if (!workshop.startDate) return [];
  return [{
    id: "legacy",
    startDate: workshop.startDate,
    endDate: workshop.endDate || workshop.startDate,
    time: workshop.time || "",
    location: workshop.location || "",
    registrationUrl: workshop.registrationUrl || "",
    capacity: workshop.capacity ?? null,
    status: workshop.status === "inactive" ? "archived" : "active",
  }];
}

export function validateSessionInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid session.");
  const date = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
  const startDate = typeof input.startDate === "string" ? input.startDate.trim() : "";
  const endDate = typeof input.endDate === "string" && input.endDate.trim() ? input.endDate.trim() : startDate;
  if (!date(startDate) || !date(endDate) || endDate < startDate) throw new Error("Enter valid session dates in chronological order.");
  const status = input.status || "active";
  if (!["active", "archived"].includes(status)) throw new Error("Session status must be active or archived.");
  const time = typeof input.time === "string" ? input.time.trim() : "";
  const location = typeof input.location === "string" ? input.location.trim() : "";
  if (time.length > 120 || location.length > 180) throw new Error("Session details are too long.");
  const capacity = input.capacity === "" || input.capacity == null ? null : Number(input.capacity);
  if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 0 || capacity > 100000)) throw new Error("Capacity must be a non-negative whole number.");
  const registrationUrl = typeof input.registrationUrl === "string" ? input.registrationUrl.trim() : "";
  if (registrationUrl) {
    let url;
    try { url = new URL(registrationUrl); } catch { throw new Error("Registration URL is invalid."); }
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Use a valid HTTPS registration URL.");
  }
  return { startDate, endDate, time, location, status, capacity, registrationUrl };
}
