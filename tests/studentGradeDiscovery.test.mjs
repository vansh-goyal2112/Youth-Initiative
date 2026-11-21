import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesStudentGrade, schoolGradeNumber } from "../src/utils/workshopGrades.mjs";
import { recommendYouthWorkshops } from "../src/utils/youthWorkshopRecommendations.mjs";
import { getDiscoverableWorkshops } from "../src/utils/discoverySpin.mjs";
import { recommendWorkshops } from "../src/services/workshopRecommendations.js";
import { normalizeSaitProgram } from "../src/services/saitProgramNormalization.js";
import { recommendSaitPrograms } from "../src/services/saitProgramRecommendations.js";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const now = new Date("2026-11-21T12:00:00Z");
const workshops = [
  { id: "younger", title: "Robotics Grade 1", grade: "Grade 1", status: "active", category: "Technology", availabilityStatus: "open" },
  { id: "mid", title: "Robotics Grade 6–9", minGrade: 6, maxGrade: 9, grade: "Grades 6-9", status: "active", category: "Technology", availabilityStatus: "open" },
  { id: "upper", title: "Robotics Grade 10–12", grade: "Grades 10 - 12", status: "active", category: "Technology", availabilityStatus: "open" },
  { id: "any", title: "Robotics Grades 1–12", grade: "Grades 1-12", status: "active", category: "Technology", availabilityStatus: "open" },
  { id: "unknown", title: "Robotics Without Published Grade", status: "active", category: "Technology", availabilityStatus: "open" },
  { id: "closed", title: "Robotics Closed", grade: "Grades 6 - 9", status: "active", category: "Technology", availabilityStatus: "closed" },
];
const student = schoolGrade => ({ schoolGrade, dateOfBirth: "2013-01-01", interests: ["robotics"], learningMode: "both" });

test("only explicit matching grade ranges show, including Grade 1 and Kindergarten", () => {
  assert.equal(schoolGradeNumber("K"), 0);
  assert.equal(schoolGradeNumber("1"), 1);
  assert.equal(schoolGradeNumber("12"), 12);
  assert.equal(schoolGradeNumber("13"), null);
  assert.equal(schoolGradeNumber(""), null);
  assert.equal(matchesStudentGrade({grade:"K-1"}, "K"), true);
  assert.equal(matchesStudentGrade(workshops[0], "1"), true);
  assert.equal(matchesStudentGrade(workshops[0], "8"), false);
  assert.equal(matchesStudentGrade(workshops[1], "8"), true);
  assert.equal(matchesStudentGrade(workshops[1], "10"), false);
  assert.equal(matchesStudentGrade(workshops[2], "10"), true);
  assert.equal(matchesStudentGrade(workshops[2], "9"), false);
  assert.equal(matchesStudentGrade(workshops[3], "1"), true);
  assert.equal(matchesStudentGrade(workshops[3], "12"), true);
  assert.equal(matchesStudentGrade(workshops[4], "8"), false);
  assert.equal(matchesStudentGrade(workshops[1], null), false);
});

test("Home recommendations filter by saved grade, preserve younger records, never suggest closed registration", () => {
  assert.deepEqual(recommendYouthWorkshops({ workshops, registrations: [], student: student("8") }).map(p=>p.id).sort(), ["any","mid"]);
  assert.deepEqual(recommendYouthWorkshops({ workshops, registrations: [], student: student("1") }).map(p=>p.id).sort(), ["any","younger"]);
  assert.deepEqual(recommendYouthWorkshops({ workshops, registrations: [], student: student("12") }).map(p=>p.id).sort(), ["any","upper"]);
  assert.deepEqual(recommendYouthWorkshops({ workshops, registrations: [], student: student(null) }), []);
  assert.equal(workshops.length, 6);
  assert.ok(workshops.some(w => w.grade === "Grade 1"));
});

test("Surprise Me uses the student's grade, excludes closed and already registered workshops", () => {
  assert.deepEqual(getDiscoverableWorkshops(workshops,[{workshopId:"any"}],now,"8").map(p=>p.id), ["mid"]);
  assert.deepEqual(getDiscoverableWorkshops(workshops,[],now,"1").map(p=>p.id), ["younger","any"]);
  assert.deepEqual(getDiscoverableWorkshops(workshops,[],now,null), []);
});

test("independent workshop recommendation endpoint logic enforces matching grade before scoring", () => {
  const recommend = g => recommendWorkshops({ student: student(g), completedWorkshops: [], workshops });
  assert.deepEqual(recommend("8").map(p=>p.workshop.id).sort(), ["any","mid"]);
  assert.deepEqual(recommend("1").map(p=>p.workshop.id).sort(), ["any","younger"]);
  assert.deepEqual(recommend("12").map(p=>p.workshop.id).sort(), ["any","upper"]);
  assert.deepEqual(recommend("").map(p=>p.workshop.id), []);
});

test("SAIT future pathways preserve unrestricted records and enforce any published grade bounds", () => {
  const make = (title, grade) => normalizeSaitProgram({
    title, description: "Robotics and coding",
    informationUrl: "https://www.sait.ca/programs-and-courses/diplomas/software-development",
    ...(grade ? {grade} : {}),
  }, now);
  const younger = make("Young Robotics", "Grade 1");
  const upper = make("Senior Robotics", "Grades 10 - 12");
  const future = make("Future Software Diploma", null);
  const recommend = g => recommendSaitPrograms({ student: student(g), completedWorkshops: [], programs: [younger,upper,future] });
  assert.deepEqual(recommend("8").map(p=>p.program.id), ["future-software-diploma"]);
  assert.deepEqual(recommend("1").map(p=>p.program.id).sort(), ["future-software-diploma","young-robotics"]);
  assert.deepEqual(recommend("12").map(p=>p.program.id).sort(), ["future-software-diploma","senior-robotics"]);
  assert.deepEqual(recommend(null), []);
});

test("server and Surprise Me enforce grade checks without touching historical claims", () => {
  assert.match(read("../src/app/api/workshops/route.js"),/matchesStudentGrade\(workshop, student\.schoolGrade\)/);
  assert.match(read("../src/app/api/workshops/[id]/route.js"),/matchesStudentGrade\(normalizedWorkshop, student\.schoolGrade\)/);
  assert.match(read("../src/app/api/registrations/route.js"),/matchesStudentGrade\(workshop, student\.schoolGrade\)/);
  assert.match(read("../src/app/dashboard/page.js"),/DiscoverySpinner workshops=\{workshops\} registrations=\{registrations\} schoolGrade=\{student\?\.schoolGrade\}/);
  assert.match(read("../src/app/api/workshops/self-report/route.js"),/\["active", "inactive"\]/);
});
