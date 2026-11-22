import test from "node:test";
import assert from "node:assert/strict";
import { collapseDuplicateWorkshopCards, workshopEditorGradeBounds, normalizeWorkshopOption, workshopProgramAreas } from "../src/utils/workshopCatalogueFields.mjs";
import { summarize } from "../src/services/engagementAnalytics.mjs";
import { recommendYouthWorkshops } from "../src/utils/youthWorkshopRecommendations.mjs";

const welding = { id: "a", title: "Welding Intermediate", programArea: "Dual Credit",
  minGrade: 6, maxGrade: 12, status: "active" };

test("numeric editor grades are validated and legacy records remain readable", () => {
  assert.deepEqual(workshopEditorGradeBounds({ minGrade: 0, maxGrade: 6 }), { minGrade: 0, maxGrade: 6 });
  assert.equal(workshopEditorGradeBounds({ minGrade: 9, maxGrade: 6, grade: "Grades 6–12" }), null);
  assert.deepEqual(workshopEditorGradeBounds({ grade: "Grades 6–12" }), { minGrade: 6, maxGrade: 12 });
  assert.equal(normalizeWorkshopOption(" digital  youth ", workshopProgramAreas), "Digital Youth");
});

test("matching titles share a catalogue card and reporting row while session offerings remain available", () => {
  const duplicate = { ...welding, id: "b", title: "Welding, Intermediate" };
  const session = { ...duplicate, id: "c", sessions: [{ id: "session" }] };
  assert.deepEqual(collapseDuplicateWorkshopCards([duplicate, welding, session]).map(workshop => workshop.id).sort(), ["a", "c"]);
  const registrations = [welding, duplicate].map(workshop => ({
    workshopId: workshop.id, studentId: "same-student", attendanceStatus: "verified",
    status: "completed", attendedAt: "2026-05-02",
  }));
  const report = summarize([welding, duplicate], registrations, "2026-05-01", "2026-06-01", "2026-05-25");
  assert.equal(report.workshops.length, 1);
  assert.equal(report.workshops[0].attended, 1);
});

test("staff-selected interests drive workshop recommendations", () => {
  const [result] = recommendYouthWorkshops({
    workshops: [{ ...welding, interestTags: ["Skilled Trades"], description: "Includes a coding lab tour." }],
    student: { schoolGrade: "8", interests: ["coding", "skilled trades"] },
  });
  assert.ok(result.recommendationReasons.includes("Matches your interest: skilled trades"));
  assert.ok(!result.recommendationReasons.includes("Matches your interest: coding"));
});
