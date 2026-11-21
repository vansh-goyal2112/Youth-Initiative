import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { studentRedemptionHistory } from "../src/utils/studentRedemptionHistory.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const base = { action: "xp_redemption", status: "completed" };

test("student history shows date, event note and actual XP spent, newest first", () => {
  const history = studentRedemptionHistory([
    { ...base, id: "older", points: 45, note: "Open House – hoodie", createdAt: "2026-10-03T12:00:00Z", completedAt: "2026-10-03T12:00:04Z" },
    { ...base, id: "newer", points: 175, note: "   Tech Day – shirt   ", createdAt: "2026-11-21T15:00:00Z", completedAt: "2026-11-21T15:00:03Z" },
  ]);
  assert.deepEqual(history, [
    { id: "newer", date: "2026-11-21T15:00:03Z", event: "Tech Day – shirt", xpSpent: 175 },
    { id: "older", date: "2026-10-03T12:00:04Z", event: "Open House – hoodie", xpSpent: 45 },
  ]);
});

test("missing event note is never replaced with an invented event or staff email", () => {
  const history = studentRedemptionHistory([{ ...base, id: "no-note", points: 100,
    note: "   ", actorEmail: "private@sait.ca", createdAt: "2026-11-21T20:00:00Z" }]);
  assert.deepEqual(history, [
    { id: "no-note", date: "2026-11-21T20:00:00Z", event: "Event not recorded", xpSpent: 100 },
  ]);
  assert.doesNotMatch(JSON.stringify(history), /private@sait\.ca/);
});

test("history excludes rejected, in-process, incomplete and non-redemption records", () => {
  const history = studentRedemptionHistory([
    { ...base, id: "valid", points: 25, createdAt: "2026-11-21T00:00:00Z" },
    { ...base, id: "pending", status: "processing", points: 100, createdAt: "2026-11-21T00:00:00Z" },
    { ...base, id: "failed", status: "rejected", points: 100, createdAt: "2026-11-21T00:00:00Z" },
    { ...base, id: "award", action: "xp_award", points: 100, createdAt: "2026-11-21T00:00:00Z" },
    { ...base, id: "zero", points: 0, createdAt: "2026-11-21T00:00:00Z" },
    { ...base, id: "fraction", points: 7.5, createdAt: "2026-11-21T00:00:00Z" },
    { ...base, id: "bad-date", points: 10, createdAt: "not-a-date" },
  ]);
  assert.deepEqual(history.map(r => r.id), ["valid"]);
  assert.deepEqual(studentRedemptionHistory(null), []);
});

test("student-only history endpoint uses authenticated UID and does not expose admin records", () => {
  const route = read("../src/app/api/rewards/history/route.js");
  assert.match(route, /requireActiveStudent\(request\)/);
  assert.match(route, /uid: studentId/);
  assert.match(route, /c\.studentId = @studentId/);
  assert.match(route, /c\.action = @action/);
  assert.match(route, /c\.status = @status/);
  assert.match(route, /studentRedemptionHistory\(records\)/);
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.doesNotMatch(route, /new URL\(request\.url\)\.searchParams/);
  assert.doesNotMatch(route, /actorEmail|actorUid/);
  assert.doesNotMatch(route, /export async function POST/);
});

test("student Badges page includes history table, empty/error/loading states, no online redemption", () => {
  const page = read("../src/app/badges/page.js");
  assert.match(page, /studentFetch\("\/api\/rewards\/history"/);
  assert.match(page, /setRedemptions\(data\.redemptions\)/);
  assert.match(page, /Redemption history/);
  assert.match(page, /Event \/ reward/);
  assert.match(page, /XP spent/);
  assert.match(page, /redemptions\.map\(item =>/);
  assert.match(page, /item\.event/);
  assert.match(page, /item\.xpSpent/);
  assert.match(page, /timeZone: "America\/Edmonton"/);
  assert.match(page, /No rewards redeemed yet/);
  assert.match(page, /redemptionLoading/);
  assert.match(page, /redemptionError/);
  assert.match(page, /gameData\.currentXp \?\? gameData\.totalXp/);
  assert.doesNotMatch(page, /studentFetch\("\/api\/admin\/rewards"/);
});

test("admin redemption ledger continues recording event note, points and completion timestamp", () => {
  const admin = read("../src/app/api/admin/rewards/route.js");
  assert.match(admin, /action: "xp_redemption", points: amount/);
  assert.match(admin, /note, status: "processing", createdAt: now/);
  assert.match(admin, /status: "completed", completedAt: cosmosNow\(\)/);
});
