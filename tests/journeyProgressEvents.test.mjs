import test from "node:test";
import assert from "node:assert/strict";
import { watchJourneyProgress } from "../src/utils/journeyProgressEvents.mjs";

test("Journey reacts to completion, queues a newer refresh, and pauses when hidden or unmounted", async () => {
  const page = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  let tick;
  page.setInterval = callback => { tick = callback; return 1; };
  page.clearInterval = () => {};
  let calls = 0;
  let finish;
  const stop = watchJourneyProgress(async () => {
    calls++;
    if (calls === 1) await new Promise(resolve => { finish = resolve; });
  }, page, doc);
  page.dispatchEvent(new Event("student-journey-progress"));
  page.dispatchEvent(Object.assign(new Event("storage"), { key: "student-journey-progress" }));
  assert.equal(calls, 1);
  finish();
  await new Promise(setImmediate);
  assert.equal(calls, 2);
  doc.visibilityState = "hidden";
  await tick();
  assert.equal(calls, 2);
  doc.visibilityState = "visible";
  doc.dispatchEvent(new Event("visibilitychange"));
  await new Promise(setImmediate);
  assert.equal(calls, 3);
  stop();
  page.dispatchEvent(new Event("focus"));
  await tick();
  assert.equal(calls, 3);
});
