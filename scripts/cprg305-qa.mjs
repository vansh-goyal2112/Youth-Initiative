import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const base = "http://youth-app:3000";
const checks = [
  ["GET", "/", 200], ["GET", "/login", 200], ["GET", "/register", 200],
  ["GET", "/resume-registration", 200], ["GET", "/admin/login", 200],
  ["GET", "/admin/reset-password", 200], ["GET", "/api/workshops", 401],
  ["GET", "/api/gamification", 401], ["GET", "/api/pathways/recommendations", 401],
  ["POST", "/api/register", 401], ["POST", "/api/register/recover", 401],
];
const headersFor = uid => ({ Authorization: "Bearer fixture-" + uid, "X-Firebase-AppCheck": "fixture-app" });
async function call(method, route, headers = {}, validate = null) {
  const start = performance.now();
  let status = 0;
  try {
    const response = await fetch(base + route, {
      method, headers, signal: AbortSignal.timeout(10000),
      ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}),
    });
    const body = await response.text();
    status = response.status;
    if (validate && status === 200 && !validate(JSON.parse(body))) status = 0;
  } catch {}
  return { at: new Date().toISOString(), method, route, status, ms: +(performance.now() - start).toFixed(2) };
}
let ready = false;
for (let i = 0; i < 25 && !ready; i++) {
  ready = (await call("GET", "/login")).status === 200;
  if (!ready) await delay(1000);
}
assert.ok(ready, "Application did not become ready across the Docker network");
const functional = [];
for (const [method, route, expected] of checks) {
  const result = await call(method, route);
  functional.push({ ...result, expected, passed: result.status === expected });
}
const signed = [
  ["/api/student/profile", "student-a", 200, b => b.student.id === "student-a"],
  ["/api/student/profile", "student-b", 200, b => b.student.id === "student-b"],
  ["/api/student/profile", "inactive", 403],
  ["/api/student/profile", "minor-pending", 403],
  ["/api/student/profile", "unknown", 401],
  ["/api/workshops", "student-a", 200, b => b.workshops.length === 100],
  ["/api/workshops/qa-workshop-001", "student-a", 200, b => b.workshop.id === "qa-workshop-001" && b.workshop.xpReward === 125],
  ["/api/workshops/qa-workshop-001", "student-b", 403],
  ["/api/workshops/no-such-id", "student-a", 404],
];
for (const [route, uid, expected, validate] of signed) {
  const result = await call("GET", route, headersFor(uid), validate);
  functional.push({ ...result, expected, passed: result.status === expected, fixtureStudent: uid });
}
writeFileSync("/evidence/functional.json", JSON.stringify(functional, null, 2));
console.log(JSON.stringify(functional));

const routes = ["/api/workshops", "/api/workshops/qa-workshop-001", "/api/student/profile"];
const baseline = [];
for (let i = 0; i < 30; i++) baseline.push(await call("GET", routes[i % routes.length], headersFor("student-a")));
const load = [];
const end = performance.now() + 300000;
await Promise.all(Array.from({ length: 10 }, async (_, worker) => {
  for (let i = worker; performance.now() < end; i++) {
    load.push(await call("GET", routes[i % routes.length], headersFor("student-a")));
    await delay(1000);
  }
}));
const all = [...baseline.map(row=>({ ...row, phase: "baseline" })), ...load.map(row=>({ ...row, phase: "load" }))];
writeFileSync("/evidence/performance.csv", "phase,utc,route,http_status,duration_ms\n" + all.map(r=>[r.phase,r.at,r.route,r.status,r.ms].join(",")).join("\n"));
function summarize(rows) {
  const times = rows.filter(r=>r.status === 200).map(r=>r.ms).sort((a,b)=>a-b);
  return { requests: rows.length, errors: rows.length-times.length, p95Ms: times[Math.ceil(times.length*.95)-1] ?? null };
}
const results = { workload: "TD19 route mix using synthetic authentication and in-memory Cosmos fixtures", baseline: summarize(baseline), load: summarize(load) };
writeFileSync("/evidence/performance.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (functional.some(r=>!r.passed)) process.exitCode = 1;
