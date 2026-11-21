import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getSelfClaimCategory, isSchoolOutreachWorkshop } from "../src/utils/workshopSelfClaim.mjs";
import { matchesStudentGrade } from "../src/utils/workshopGrades.mjs";
import { awardForCompletion } from "../src/services/completionRules.mjs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("student can claim current-grade and any earlier-grade workshop, without exposing future grades", () => {
  const current = { title: "Intro to Robotics", grade: "Grades 8 - 10", status: "active" };
  const earlier = { title: "Junior Coding", grade: "Grades 6 - 7", status: "inactive" };
  const muchEarlier = { title: "Grade 1 art", minGrade: 1, maxGrade: 2, status: "active" };
  const future = { title: "Advanced Welding", grade: "Grades 11 - 12", status: "active" };
  assert.equal(getSelfClaimCategory(current, "8"), "current");
  assert.equal(getSelfClaimCategory(earlier, "8"), "earlier");
  assert.equal(getSelfClaimCategory(muchEarlier, "8"), "earlier");
  assert.equal(getSelfClaimCategory(future, "8"), null);
  assert.equal(getSelfClaimCategory(future, "12"), "current");
  assert.equal(getSelfClaimCategory(earlier, "6"), "current");
  assert.equal(getSelfClaimCategory(earlier, "5"), null);
  // Current-grade catalogue must stay strict and not include earlier courses.
  assert.equal(matchesStudentGrade(earlier, "8"), false);
  assert.equal(matchesStudentGrade(current, "8"), true);
});

test("Grade 1 and younger-grade records remain claimable as students progress", () => {
  const gradeOne = { title: "Grade 1 coding", grade: "Grade 1" };
  assert.equal(getSelfClaimCategory(gradeOne, "1"), "current");
  assert.equal(getSelfClaimCategory(gradeOne, "7"), "earlier");
  assert.equal(getSelfClaimCategory(gradeOne, "K"), null);
  assert.equal(getSelfClaimCategory(gradeOne, ""), null);
  assert.equal(getSelfClaimCategory(gradeOne, null), null);
  assert.equal(getSelfClaimCategory({ ...gradeOne, audience: "educators" }, "7"), null);
  assert.equal(getSelfClaimCategory({ ...gradeOne, status: "deleted" }, "7"), null);
});

test("school outreach is claimable even when registration or grade data was never recorded", () => {
  for (const title of [
    "1-Day On-campus Activities",
    "One-Day On-Campus Activities",
    "1 Day on Campus Activities",
    "Youth Outreach Visit",
    "School Field Trip",
    "School Visits",
  ]) {
    const workshop = { id: "outreach", title, status: "active" };
    assert.equal(isSchoolOutreachWorkshop(workshop), true, title);
    assert.equal(getSelfClaimCategory(workshop, "8"), "outreach", title);
  }
  assert.equal(getSelfClaimCategory({ title: "Arts", programArea: "Youth Outreach" }, "10"), "outreach");
  assert.equal(getSelfClaimCategory({ title: "Art", outreach: true }, "6"), "outreach");
  assert.equal(getSelfClaimCategory({ title: "1-Day On-campus Activities", grade: "Grades 10-12" }, "8"), null);
  assert.equal(getSelfClaimCategory({ title: "1-Day On-campus Activities", grade: "Grades 6-7" }, "8"), "outreach");
  assert.equal(getSelfClaimCategory({ title: "Unspecified grades", status: "active" }, "8"), null);
});

test("existing half-XP award rules are unchanged for past outreach and earlier grades", () => {
  assert.equal(awardForCompletion({ xpReward: 175 }, "self_reported"), 87);
  assert.equal(awardForCompletion({ xpReward: 100 }, "self_reported"), 50);
  assert.equal(awardForCompletion({ xpReward: 175 }, "qr"), 175);
});

test("self-claim API uses historical eligibility both when listing and submitting", () => {
  const api = source("../src/app/api/workshops/self-report/route.js");
  assert.match(api, /getSelfClaimCategory\(item, student\.schoolGrade\)/);
  assert.match(api, /!getSelfClaimCategory\(workshop, student\.schoolGrade\)/);
  assert.match(api, /status: 403/);
  assert.match(api, /gradeRequired: true/);
  assert.match(api, /WHERE NOT IS_DEFINED\(c\.status\) OR c\.status != 'deleted'/);
  assert.match(api, /status === "completed" \|\| item\.status === "reversed"/);
  assert.match(api, /completionTransactionId\(uid, workshopId, sessionId\)/);
  assert.match(api, /awardForCompletion\(workshop, "self_reported"\)/);
  assert.match(api, /reviewStatus: "pending_review"/);
  assert.match(api, /consumeAppCheck: true/);
});

test("self-claim picker groups current, prior and outreach programs and shows actual half XP", () => {
  const component = source("../src/components/workshops/SelfReportWorkshop.jsx");
  assert.match(component, /Your current grade/);
  assert.match(component, /Earlier grades/);
  assert.match(component, /School outreach activities/);
  assert.match(component, /workshop\.xpReward/);
  assert.match(component, /gradeRequired/);
  assert.match(component, /A personal registration is not required/);
  const catalogue = source("../src/app/api/workshops/route.js");
  const registration = source("../src/app/api/registrations/route.js");
  assert.match(catalogue, /matchesStudentGrade\(workshop, student\.schoolGrade\)/);
  assert.match(registration, /matchesStudentGrade\(workshop, student\.schoolGrade\)/);
});
