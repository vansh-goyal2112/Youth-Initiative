import test from "node:test";
import assert from "node:assert/strict";
import { resolveWorkshopSessions, validateSessionInput } from "../src/services/workshopSessions.mjs";

test("legacy workshops retain their original date and URL as a virtual session", () => {
  const sessions = resolveWorkshopSessions({ startDate: "2026-10-25", registrationUrl: "https://sait.ca/a" });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, "legacy");
  assert.equal(sessions[0].registrationUrl, "https://sait.ca/a");
});
test("new multiple sessions remain distinct and historical statuses persist", () => {
  const sessions = resolveWorkshopSessions({ sessions: [{ id: "one", status: "archived" }, { id: "two", status: "active" }] });
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].status, "archived");
});
test("validates dates, capacity and HTTPS links", () => {
  assert.equal(validateSessionInput({ startDate: "2027-01-20", capacity: 15, registrationUrl: "https://sait.ca/register" }).endDate, "2027-01-20");
  assert.throws(() => validateSessionInput({ startDate: "2027-02-30" }), /valid session dates/);
  assert.throws(() => validateSessionInput({ startDate: "2027-01-20", endDate: "2027-01-19" }), /valid session dates/);
  assert.throws(() => validateSessionInput({ startDate: "2027-01-20", registrationUrl: "javascript:alert(1)" }), /HTTPS/);
});
