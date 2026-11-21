import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attendanceCelebrationDetails } from "../src/utils/attendanceCelebration.mjs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("real verified attendance celebrates the actual configurable XP and new badge names", () => {
  const result = attendanceCelebrationDetails({
    success: true, rewardPending: false,
    reward: {
      xpEarned: 175, totalXp: 425, level: 3, levelName: "Explorer",
      newBadges: [{ id: "first-step", name: "First Step" }, { id: "tech", name: "Tech Explorer" }],
    },
  });
  assert.equal(result.confirmedReward, true);
  assert.equal(result.xpEarned, 175);
  assert.deepEqual(result.newBadges.map(b => b.name), ["First Step", "Tech Explorer"]);
});

test("normal verified workshop XP without a new badge still celebrates actual XP", () => {
  const result = attendanceCelebrationDetails({ rewardPending: false, reward: { xpEarned: 75, newBadges: [] } });
  assert.equal(result.confirmedReward, true);
  assert.equal(result.xpEarned, 75);
  assert.deepEqual(result.newBadges, []);
});

test("pending, missing, zero or invalid XP must not trigger fake rewards or fireworks", () => {
  const cases = [
    { rewardPending: true, reward: { xpEarned: 100, newBadges: [{ id: "fake", name: "Fake" }] } },
    { rewardPending: true },
    { reward: null },
    { reward: { xpEarned: 0, newBadges: [{ id: "badge", name: "Old Badge" }] } },
    { reward: { xpEarned: -1 } },
    { reward: { xpEarned: "not-a-number" } },
  ];
  for (const value of cases) {
    const result = attendanceCelebrationDetails(value);
    assert.equal(result.confirmedReward, false, JSON.stringify(value));
    assert.equal(result.xpEarned, 0);
    assert.deepEqual(result.newBadges, []);
  }
});

test("invalid badge objects are not displayed even with confirmed rewards", () => {
  const result = attendanceCelebrationDetails({
    reward: { xpEarned: 125, newBadges: [null, {}, { id: "legit", name: "Workshop Champion" }] },
  });
  assert.deepEqual(result.newBadges, [{ id: "legit", name: "Workshop Champion" }]);
});

test("both QR scans and four-digit submissions open the same in-page success popup", () => {
  const page = source("../src/app/scan-attendance/page.js");
  assert.match(page, /async function verifyAttendance\(payload\)/);
  assert.match(page, /await verifyAttendance\(\{\s*attendanceSessionId: payload\.attendanceSessionId,\s*code: payload\.code,/);
  assert.match(page, /void verifyAttendance\(\{ manualCode \}\)/);
  assert.match(page, /setAttendanceResult\(data\)/);
  assert.match(page, /<AttendanceCelebration result=\{attendanceResult\} onClose=\{closeCelebration\} \/>/);
  assert.match(page, /verifyingReference\.current = false;/);
  assert.doesNotMatch(page, /router\.push\("\/reward"\)/);
});

test("popup celebrates actual XP, shows each newly unlocked badge, fireworks and appropriate pending state", () => {
  const component = source("../src/components/attendance/AttendanceCelebration.jsx");
  const styles = source("../src/components/attendance/attendanceCelebration.module.css");
  assert.match(component, /attendanceCelebrationDetails\(result\)/);
  assert.match(component, /Congratulations!/);
  assert.match(component, /Badge/);
  assert.match(component, /New badges unlocked!/);
  assert.match(component, /\+\{earnedXp\} XP/);
  assert.match(component, /badges\.map\(badge =>/);
  assert.match(component, /badge\.name/);
  assert.match(component, /import\("canvas-confetti"\)/);
  assert.match(component, /particleCount: 75/);
  assert.match(component, /prefers-reduced-motion: reduce/);
  assert.match(component, /role="dialog" aria-modal="true"/);
  assert.match(component, /still being processed/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@keyframes celebrationAppear/);
});

test("verification still requires a real completed transaction and preserves existing full-XP safeguards", () => {
  const api = source("../src/app/api/attendance/verify/route.js");
  assert.match(api, /processWorkshopCompletion\(\{/);
  assert.match(api, /completionSource: "qr"/);
  assert.match(api, /rewardPending = true/);
  assert.match(api, /finalized|status !== "completed"/i);
  assert.match(api, /isCosmosPreconditionFailed\(error\)/);
  assert.match(api, /item\.status === "upcoming"/);
  assert.match(api, /const manual = manualCode !== undefined/);
});
