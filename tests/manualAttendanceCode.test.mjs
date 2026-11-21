import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  generateManualAttendanceCode,
  isValidManualAttendanceCode,
  nextManualCodeAttempt,
  MAX_MANUAL_CODE_ATTEMPTS,
  MANUAL_ATTEMPT_WINDOW_MS,
} from "../src/services/attendanceManualCode.mjs";
import { awardForCompletion } from "../src/services/completionRules.mjs";

const source = file => readFileSync(new URL(file, import.meta.url), "utf8");

test("generated attendance code is always exactly four numeric characters", () => {
  const generated = new Set();
  for (let i = 0; i < 150; i++) {
    const code = generateManualAttendanceCode();
    assert.match(code, /^[0-9]{4}$/);
    assert.equal(isValidManualAttendanceCode(code), true);
    generated.add(code);
  }
  assert.ok(generated.size > 1, "New sessions must use randomized codes");
  assert.equal(isValidManualAttendanceCode("0000"), true);
  assert.equal(isValidManualAttendanceCode("0019"), true);
  assert.equal(isValidManualAttendanceCode("9999"), true);
  for (const value of ["", "1", "123", "12345", "12a4", "12 4", "12-4", 1234, null, undefined]) {
    assert.equal(isValidManualAttendanceCode(value), false, String(value));
  }
});

test("a student is limited to five attempts in a 15-minute window, then resets", () => {
  const now = Date.parse("2026-11-21T10:00:00Z");
  let state = null;
  for (let i = 1; i <= MAX_MANUAL_CODE_ATTEMPTS; i++) {
    const result = nextManualCodeAttempt(state, now + i * 1000);
    assert.equal(result.allowed, true);
    assert.equal(result.next.attempts, i);
    state = result.next;
  }
  const blocked = nextManualCodeAttempt(state, now + 6000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.next, null);
  const afterWindow = nextManualCodeAttempt(state, now + MANUAL_ATTEMPT_WINDOW_MS + 1001);
  assert.equal(afterWindow.allowed, true);
  assert.equal(afterWindow.next.attempts, 1);
});

test("four-digit session generation happens server-side and avoids active-code collisions", () => {
  const admin = source("../src/app/api/admin/attendance/route.js");
  const adminUi = source("../src/app/admin/attendance/page.js");
  assert.match(admin, /generateManualAttendanceCode\(\)/);
  assert.match(admin, /for \(let attempt = 0; attempt < 30; attempt\+\+\)/);
  assert.match(admin, /c\.manualCode = @code AND c\.active = true AND c\.expiresAt > @now/);
  assert.match(admin, /manualCode,/);
  assert.match(adminUi, /setManualCode\(data\.manualCode\)/);
  assert.match(adminUi, /manualCode\.split\(""\)\.join\(" "\)/);
  assert.match(adminUi, /Camera not working\? Enter this attendance code/);
  assert.match(adminUi, /Code expires at/);
  assert.match(adminUi, /setManualCode\(""\)/);
  assert.match(adminUi, /attendanceSessionId: data\.attendanceSessionId, code: data\.code/);
});

test("QR and manual codes share the same server-side expiry, registration, completion and XP flow", () => {
  const verify = source("../src/app/api/attendance/verify/route.js");
  assert.match(verify, /manualCode !== undefined/);
  assert.match(verify, /isValidManualAttendanceCode\(manualCode\)/);
  assert.match(verify, /reserveManualCodeAttempt\(studentId\)/);
  assert.match(verify, /SELECT TOP 2 \* FROM c WHERE c\.manualCode = @code/);
  assert.match(verify, /matches\.length !== 1/);
  assert.match(verify, /status: 429/);
  assert.match(verify, /consumeAppCheck:\s*true/);
  assert.match(verify, /session\.expiresAt/);
  assert.match(verify, /c\.studentId = @studentId/);
  assert.match(verify, /item\.status === "upcoming"/);
  assert.match(verify, /isCosmosPreconditionFailed\(error\)/);
  assert.match(verify, /completionSource: "qr"/);
  assert.match(verify, /attendanceStatus:\s*"verified"/);
  assert.match(verify, /processWorkshopCompletion\(\{/);
  assert.match(verify, /completionTransactionId\(studentId, session\.workshopId, registration\.sessionId \|\| null\)/);
  assert.equal(awardForCompletion({ xpReward: 175 }, "qr"), 175);
  assert.equal(awardForCompletion({ xpReward: 175 }, "self_reported"), 87);
});

test("student can enter four digits instead of opening a camera", () => {
  const student = source("../src/app/scan-attendance/page.js");
  assert.match(student, /Enter code instead/);
  assert.match(student, /Scan QR instead/);
  assert.match(student, /manualCode\.length !== 4/);
  assert.match(student, /inputMode="numeric"/);
  assert.match(student, /maxLength=\{4\}/);
  assert.match(student, /void verifyAttendance\(\{ manualCode \}\)/);
  assert.match(student, /JSON\.parse\(qrText\)/);
  assert.match(student, /await stopCamera\(\)/);
  assert.match(student, /limitedUse: true/);
  // Both check-in modes now display their server-confirmed reward in a popup.
  assert.match(student, /setAttendanceResult\(data\)/);
  assert.match(student, /<AttendanceCelebration result=\{attendanceResult\} onClose=\{closeCelebration\} \/>/);
});
