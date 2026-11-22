import test from "node:test";
import assert from "node:assert/strict";
import { checkWorkshopDuplicate } from "../src/utils/workshopDuplicates.mjs";
import { getSelfClaimCategory } from "../src/utils/workshopSelfClaim.mjs";

const keep = {
  id: "primary", title: "Welding Intermediate", programArea: "Youth Programs",
  status: "active", minGrade: 7, maxGrade: 12, xpReward: 100,
};
const duplicate = { ...keep, id: "duplicate", title: "Welding, Intermediate" };

test("equivalent title variations qualify for reversible catalogue consolidation", () => {
  assert.equal(checkWorkshopDuplicate(keep, duplicate), null);
  assert.equal(checkWorkshopDuplicate({ ...keep, grade: "Grades 7–12" }, duplicate), null);
});

test("different XP, scheduling, enrolment or custom artwork prevents consolidation", () => {
  assert.match(checkWorkshopDuplicate(keep, { ...duplicate, xpReward: 175 }), /XP/);
  assert.match(checkWorkshopDuplicate(keep, { ...duplicate, sessions: [{ id: "spring" }] }), /scheduled/);
  assert.match(checkWorkshopDuplicate(keep, { ...duplicate, registrationUrl: "https://example.test/other" }), /details differ/);
  assert.match(checkWorkshopDuplicate(keep, { ...duplicate, imageStatus: "custom", image: "/other.webp" }), /image/);
});

test("consolidated duplicates are excluded from past-attendance claims", () => {
  assert.equal(getSelfClaimCategory({ ...duplicate, status: "inactive", duplicateOf: keep.id }, "8"), null);
  assert.equal(getSelfClaimCategory({ ...duplicate, status: "inactive" }, "8"), "current");
});
