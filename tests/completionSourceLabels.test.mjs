import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSelfReportedCompletion } from "../src/utils/completionSourceLabels.mjs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("students and staff can identify a self-claimed completion by the persisted source", () => {
  const claim = {
    status: "completed",
    completionSource: "self_reported",
    attendanceStatus: "self_reported",
    reviewStatus: "pending_review",
  };
  assert.equal(isSelfReportedCompletion(claim), true);
  assert.equal(isSelfReportedCompletion({ ...claim, reviewStatus: "approved" }), true);
  assert.equal(isSelfReportedCompletion({ ...claim, status: "reversed", attendanceStatus: "reversed" }), true);
});

test("QR-verified and legacy non-self-reported completions are never tagged as self-reported", () => {
  assert.equal(isSelfReportedCompletion({
    status: "completed", completionSource: "qr", attendanceStatus: "verified",
  }), false);
  assert.equal(isSelfReportedCompletion({ completionSource: "qr", attendanceStatus: "self_reported" }), false);
  assert.equal(isSelfReportedCompletion({ attendanceStatus: "verified" }), false);
  assert.equal(isSelfReportedCompletion({ status: "upcoming", attendanceStatus: "pending" }), false);
  assert.equal(isSelfReportedCompletion({ status: "completed" }), false);
  assert.equal(isSelfReportedCompletion(null), false);
});

test("legacy self-claims with only an attendance status still receive the correct label", () => {
  assert.equal(isSelfReportedCompletion({ attendanceStatus: "self_reported" }), true);
  assert.equal(isSelfReportedCompletion({ completionSource: null, attendanceStatus: "self_reported" }), true);
});

test("student Completed Workshops cards show the label only for self-reports", () => {
  const page = source("../src/app/completed-workshops/page.js");
  assert.match(page, /import \{ isSelfReportedCompletion \} from/);
  assert.match(page, /isSelfReportedCompletion\(registration\) && \(/);
  assert.match(page, /Self-reported/);
  assert.match(page, /<span className="completed-status-badge">/);
  assert.match(page, /<SelfReportWorkshop onClaimed=/);
  assert.match(page, /registration\.status ===\s*"completed"/);
});

test("admin review explicitly shows Self-reported beside its separate review status", () => {
  const page = source("../src/app/admin/completions/page.js");
  const api = source("../src/app/api/admin/completions/route.js");
  assert.match(page, /Self-reported/);
  assert.match(page, /claim\.reviewStatus\?\.replaceAll/);
  assert.match(api, /c\.completionSource = @source/);
  assert.match(api, /value: "self_reported"/);
});

test("admin student report preserves source and visually distinguishes self-reported history", () => {
  const ui = source("../src/app/admin/reports/page.js");
  const api = source("../src/app/api/admin/reports/student/route.js");
  assert.match(ui, /isSelfReportedCompletion\(r\) && \(/);
  assert.match(ui, /Self-reported/);
  assert.match(api, /completionSource: item\.completionSource \|\| null/);
  assert.match(api, /attendanceStatus: item\.attendanceStatus \|\| null/);
  // The CSV shares the same registration projection; no separate source-loss path.
  assert.match(api, /Object\.entries\(r\)\.map\(\(\[key, value\]\) => csvRow\(\[\x60Registration/);
});

test("attendance method changes are display-only: QR and self-report XP paths remain separate", () => {
  const qr = source("../src/app/api/attendance/verify/route.js");
  const claim = source("../src/app/api/workshops/self-report/route.js");
  assert.match(qr, /completionSource: "qr"/);
  assert.match(qr, /attendanceStatus:\s*"verified"/);
  assert.match(claim, /completionSource: "self_reported"/);
  assert.match(claim, /attendanceStatus: "self_reported"/);
  assert.match(claim, /reviewStatus: "pending_review"/);
  assert.match(claim, /awardForCompletion\(workshop, "self_reported"\)/);
});
