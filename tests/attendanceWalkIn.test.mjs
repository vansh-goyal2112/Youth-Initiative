import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function moduleUrl(code) {
  return "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}

const route = new URL("../src/app/api/attendance/verify/route.js", import.meta.url);
const appModules = new Map([
  ["@/services/studentAccess", `
    export const requireActiveStudent = () => ({ uid: "student", student: { schoolGrade: "8" } });
    export const studentAccessResponse = () => null;
  `],
  ["@/services/cosmosData", `
    const db = globalThis[Symbol.for("attendanceWalkInTest")];
    export const cosmosNow = () => new Date().toISOString();
    export const isCosmosConflict = error => error.code === 409;
    export const isCosmosPreconditionFailed = error => error.code === 412;
    export const readCosmosDocument = async (container, id) => db[container].get(id) || null;
    export const queryCosmosDocuments = async container => [...db[container].values()];
    export async function createCosmosDocument(container, record) {
      if (db[container].has(record.id)) throw { code: 409 };
      const saved = { ...record, _etag: 1 };
      db[container].set(record.id, saved);
      return saved;
    }
    export async function replaceCosmosDocument(container, record, changes) {
      if (db[container].get(record.id)?._etag !== record._etag) throw { code: 412 };
      const saved = { ...record, ...changes, _etag: record._etag + 1 };
      db[container].set(record.id, saved);
      return saved;
    }
  `],
  ["@/services/workshopXpMigration", "export const ensureWorkshopXpAssigned = async workshop => workshop;"],
  ["@/services/workshopEligibility", 'export const getWorkshopEligibility = () => ({ status: "eligible" });'],
  ["@/services/gamificationAdmin", `
    import { completionTransactionId } from "${new URL("../src/services/completionRules.mjs", import.meta.url)}";
    const db = globalThis[Symbol.for("attendanceWalkInTest")];
    export async function processWorkshopCompletion({ studentId, workshopId, sessionId, workshop }) {
      const id = completionTransactionId(studentId, workshopId, sessionId);
      db.xpTransactions.set(id, { status: "completed", points: workshop.xpReward });
      db.awards++;
      return { xpEarned: workshop.xpReward };
    }
  `],
]);

test("QR walk-ins register and earn full XP once per experience, including concurrent scans", async () => {
  const symbol = Symbol.for("attendanceWalkInTest");
  const db = globalThis[symbol] = {
    registrations: new Map(),
    attendanceSessions: new Map(),
    xpTransactions: new Map(),
    workshops: new Map(),
    awards: 0,
  };
  const sessions = ["first", "second"].map(id => ({ id, status: "active" }));
  db.workshops.set("robotics", { id: "robotics", title: "Robotics", status: "active", xpReward: 175, sessions });
  for (const { id } of sessions) {
    db.attendanceSessions.set(id, {
      id, workshopId: "robotics", catalogSessionId: id, code: id + "-code",
      active: true, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  }
  const source = (await readFile(route, "utf8")).replace(/"(@\/services\/[^"]+)"/g, (_, specifier) =>
    JSON.stringify(appModules.has(specifier) ? moduleUrl(appModules.get(specifier)) :
      new URL("../src/" + specifier.slice(2), import.meta.url).href));
  const { POST } = await import(moduleUrl(source));
  const scan = (id, code = id + "-code") => POST(new Request("https://example.test", {
    method: "POST", body: JSON.stringify({ attendanceSessionId: id, code }),
  }));
  try {
    assert.equal((await scan("first", "wrong")).status, 401);
    assert.equal(db.registrations.size, 0);
    const firstRound = await Promise.all([scan("first"), scan("first"), scan("second")]);
    assert.deepEqual(firstRound.map(response => response.status).sort(), [200, 409, 409]);
    assert.equal((await firstRound.find(response => response.ok).json()).reward.xpEarned, 175);
    assert.equal(db.awards, 1);
    assert.equal(db.registrations.size, 1);
    const [saved] = db.registrations.values();
    assert.equal(saved.status, "completed");
    assert.equal(saved.attendanceStatus, "verified");
    assert.equal(saved.completionXpAwarded, true);
    assert.equal(saved.externalRegistrationConfirmed, false);
    assert.equal((await scan("second")).status, 409);

    for (const key of db.attendanceSessions.keys()) {
      if (key.startsWith("attendance-claim:")) db.attendanceSessions.delete(key);
    }
    db.registrations.clear();
    db.xpTransactions.clear();
    db.registrations.set("existing", {
      id: "existing", studentId: "student", workshopId: "robotics", sessionId: "first",
      status: "upcoming", externalRegistrationConfirmed: true, _etag: 1,
    });
    assert.equal((await scan("first")).status, 200);
    assert.equal(db.registrations.size, 1);
    assert.equal(db.registrations.get("existing").attendanceStatus, "verified");
    assert.equal(db.registrations.get("existing").externalRegistrationConfirmed, true);
    assert.equal(db.awards, 2);
  } finally {
    delete globalThis[symbol];
  }
});
