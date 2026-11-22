import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getWorkshopEligibility } from "../src/services/workshopEligibility.js";
import {
  parseGradeRange,
  getWorkshopGradeBounds,
  formatWorkshopGradeRange,
  normalizeWorkshopGrades,
  workshopGradeOptions,
  matchesWorkshopGrade,
  matchesStudentGrade,
  schoolGradeNumber,
} from "../src/utils/workshopGrades.mjs";

const src = file => readFileSync(new URL(file, import.meta.url), "utf8");

test("near-duplicate grade labels normalize to identical numeric bounds", () => {
  for (const label of ["Grade 6 - 12", "Grades 6 - 12", "Grades 6-12", "Grade 6–12", "6 to 12"]) {
    assert.deepEqual(parseGradeRange(label), { minGrade: 6, maxGrade: 12 }, label);
    assert.equal(formatWorkshopGradeRange(parseGradeRange(label)), "Grades 6 - 12");
  }
  for (const label of ["Grade 7-12", "Grades 7-12", "Grades 7 - 12", "Grades 7—12"]) {
    assert.deepEqual(parseGradeRange(label), { minGrade: 7, maxGrade: 12 }, label);
  }
  assert.deepEqual(parseGradeRange("Grade 6"), { minGrade: 6, maxGrade: 6 });
  assert.deepEqual(parseGradeRange("Grades K-6"), { minGrade: 0, maxGrade: 6 });
  assert.equal(formatWorkshopGradeRange(parseGradeRange("K-6")), "Kindergarten - Grade 6");
  assert.equal(formatWorkshopGradeRange(parseGradeRange("Grade K")), "Kindergarten");
  assert.deepEqual(parseGradeRange("Kindergarten"), { minGrade: 0, maxGrade: 0 });
  assert.deepEqual(parseGradeRange("Kindergarten - Grade 6"), { minGrade: 0, maxGrade: 6 });
  for (const label of ["K-6", "Grade K", "Grades 6-12", "Grades 7–12"]) {
    const parsed = parseGradeRange(label);
    assert.deepEqual(parseGradeRange(formatWorkshopGradeRange(parsed)), parsed, label);
  }
});

test("unrecognized or reversed grades are not guessed from unrelated numbers", () => {
  for (const label of ["", "Ages 6 - 12", "Grades 13-15", "Grades 12 - 6", "Summer 2026", "Grade 6 - 14"]) {
    assert.equal(parseGradeRange(label), null, label);
  }
  assert.equal(getWorkshopGradeBounds({ grade: "unpublished" }), null);
  assert.deepEqual(getWorkshopGradeBounds({ grade: "Grades 6-12", minGrade: 7, maxGrade: 9 }), {
    minGrade: 7, maxGrade: 9,
  });
  assert.deepEqual(getWorkshopGradeBounds({ grade: "Grades 6-12", minGrade: null, maxGrade: null }), {
    minGrade: 6, maxGrade: 12,
  });
  assert.deepEqual(getWorkshopGradeBounds({ minGrade: 8, maxGrade: null }), { minGrade: 8, maxGrade: 8 });
  assert.equal(formatWorkshopGradeRange({ minGrade: 12, maxGrade: 6 }), "");
});

test("catalogue filter lists individual grades in numeric order with no duplicate ranges", () => {
  const workshops = [
    { id: "first", grade: "Grade 6 - 12" },
    { id: "second", grade: "Grades 6-12" },
    { id: "third", grade: "Grades 7 - 12" },
    { id: "fourth", grade: "Grades 7-12" },
    { id: "fifth", minGrade: 6, maxGrade: 9, grade: "Grades 6 - 9" },
  ];
  const options = workshopGradeOptions(workshops);
  assert.deepEqual(options.map(o => o.value), ["6","7","8","9","10","11","12"]);
  assert.deepEqual(options.map(o => o.label), ["Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12"]);
  assert.equal(workshops.filter(w => matchesWorkshopGrade(w,"6")).length, 3);
  assert.equal(workshops.filter(w => matchesWorkshopGrade(w,"7")).length, 5);
  assert.equal(workshops.filter(w => matchesWorkshopGrade(w,"12")).length, 4);
  assert.equal(workshops.filter(w => matchesWorkshopGrade(w,"all")).length, 5);
  assert.equal(matchesWorkshopGrade(workshops[0], "13"), false);
  assert.equal(matchesWorkshopGrade({grade:"Unknown"}, "7"), false);
  assert.equal(matchesWorkshopGrade({grade:"K - 6"}, "0"), true);
});

test("normalization keeps existing workshop identity and XP and respects numeric bounds", () => {
  const legacy = { id: "workshop-123", grade: "Grades 7-12", xpReward: 175, status: "active", sessions: [{ id: "s1", startDate: "2026-12-05" }] };
  const normalized = normalizeWorkshopGrades(legacy);
  assert.deepEqual({ grade: normalized.grade, minGrade: normalized.minGrade, maxGrade: normalized.maxGrade },
    { grade: "Grades 7 - 12", minGrade: 7, maxGrade: 12 });
  assert.equal(normalized.id, legacy.id);
  assert.equal(normalized.xpReward, 175);
  assert.equal(normalized.sessions, legacy.sessions);
  assert.equal(legacy.minGrade, undefined);
  assert.equal(legacy.grade, "Grades 7-12");
  assert.equal(getWorkshopEligibility(normalized, { schoolGrade: "6" }).status, "ineligible");
  assert.equal(getWorkshopEligibility(normalized, { schoolGrade: "7" }).status, "eligible");
  assert.equal(getWorkshopEligibility({ grade: "Grade 6 - 12" }, { schoolGrade: "12" }).status, "eligible");
});

test("student catalogue uses grade range matching and canonical API labels", () => {
  const page = src("../src/app/workshops/page.js");
  const catalogue = src("../src/app/api/workshops/route.js");
  const detail = src("../src/app/api/workshops/[id]/route.js");
  assert.match(page, /workshopGradeOptions\(workshops\)/);
  assert.match(page, /matchesWorkshopGrade\(workshop, gradeFilter\)/);
  assert.doesNotMatch(page, /workshop\.grade === gradeFilter/);
  assert.match(catalogue, /normalizeWorkshopGrades\(workshop\)/);
  assert.match(detail, /normalizeWorkshopGrades\(workshop\)/);
  assert.match(catalogue, /getWorkshopEligibility\(/);
});

test("manual workshop saves and Excel imports persist min/max while keeping import IDs stable", () => {
  const admin = src("../src/app/api/admin/workshops/route.js");
  const importer = src("../src/app/api/admin/workshops/import/route.js");
  assert.match(admin, /gradeBounds = workshopEditorGradeBounds\(workshop\)/);
  assert.match(admin, /minGrade: gradeBounds\.minGrade/);
  assert.match(admin, /maxGrade: gradeBounds\.maxGrade/);
  assert.match(importer, /minGrade: gradeBounds\?\.minGrade \?\? null/);
  assert.match(importer, /maxGrade: gradeBounds\?\.maxGrade \?\? null/);
  assert.match(importer, /minGrade: workshopData\.minGrade/);
  assert.match(importer, /maxGrade: workshopData\.maxGrade/);
  assert.match(importer, /createWorkshopId\(\s*workshop\.title,\s*workshop\.programArea,\s*workshop\.offeringYear \|\| "",\s*workshop\.grade \|\| ""/);
  assert.match(importer, /xpConfiguredByImport: workshop\.xpReward != null/);
});
