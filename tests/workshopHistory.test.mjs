import test from "node:test";
import assert from "node:assert/strict";
import { workshopCompletionSnapshot } from "../src/services/workshopHistory.mjs";

test("completed workshop history survives catalogue removal independently", () => {
  const workshop = { id: "ai-2026", title: "AI Workshop", category: "Technology", offeringYear: "2026", xpReward: 100 };
  const registration = { id: "reg1", workshopId: "ai-2026", status: "completed", completedAt: "2026-10-20T00:00:00Z" };
  const snapshot = workshopCompletionSnapshot(workshop, registration, { status: "completed", points: 100 });
  assert.equal(snapshot.title, "AI Workshop");
  assert.equal(snapshot.xpReward, 100);
  assert.equal(snapshot.completedAt, registration.completedAt);
  assert.equal(snapshot.category, "Technology");
  assert.equal(snapshot.offeringYear, "2026");
});

test("cannot create a history snapshot for an incomplete registration", () => {
  assert.throws(() => workshopCompletionSnapshot({ id: "ai" }, { id: "x", workshopId: "ai", status: "registered" }), /completed/);
});

test("cannot attach a workshop snapshot to the wrong registration", () => {
  assert.throws(() => workshopCompletionSnapshot({ id: "ai" }, { id: "x", workshopId: "robotics", status: "completed" }), /mismatch/);
});
