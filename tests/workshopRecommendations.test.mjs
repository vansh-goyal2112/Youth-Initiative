import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_RECOMMENDATION_WEIGHTS,
  recommendWorkshops,
} from "../src/services/workshopRecommendations.js";

const TODAY = new Date("2026-10-24T12:00:00.000Z");

const student = {
  interests: ["Coding"],
  learningMode: "online",
  dateOfBirth: "2012-04-03",
  schoolGrade: "8",
};

function workshop(overrides) {
  return {
    id: "w",
    title: "Workshop",
    description: "",
    category: "Other",
    status: "active",
    audience: "students",
    learningMode: null,
    ...overrides,
  };
}

function recommend(input, options = {}) {
  return recommendWorkshops(
    { completedWorkshops: [], workshops: [], ...input },
    { today: TODAY, ...options }
  );
}

test("ranks workshops by interest and explains why", () => {
  const results = recommend({
    student,
    workshops: [
      workshop({ id: "art", title: "Art Studio", category: "Design & Creativity" }),
      workshop({
        id: "py",
        title: "Python Coding",
        category: "Technology",
        learningMode: "online",
      }),
    ],
  });

  assert.deepEqual(results.map((r) => r.workshop.id), ["py"]);
  assert.equal(results[0].score, 30 + 20 + 15);
  assert.ok(results[0].reasons.length >= 2);
});

test("excludes completed, registered, inactive and ineligible workshops", () => {
  const base = { category: "Technology", title: "Coding Basics" };
  const results = recommend({
    student,
    completedWorkshops: [workshop({ id: "done", ...base })],
    registeredWorkshopIds: ["registered"],
    workshops: [
      workshop({ id: "done", ...base }),
      workshop({ id: "registered", ...base }),
      workshop({ id: "inactive", status: "inactive", ...base }),
      workshop({ id: "educators", audience: "educators", ...base }),
      workshop({ id: "too-old", minGrade: 11, maxGrade: 12, ...base }),
      workshop({ id: "ok", ...base }),
    ],
  });

  assert.deepEqual(results.map((r) => r.workshop.id), ["ok"]);
});

test("recommends follow-ups in the category of a completed workshop", () => {
  const results = recommend({
    student: { ...student, interests: [] },
    completedWorkshops: [
      workshop({ id: "done", title: "Intro to Robotics", category: "Technology" }),
    ],
    workshops: [
      workshop({ id: "next", title: "Advanced Builds", category: "Technology" }),
      workshop({ id: "far", title: "Cooking", category: "Culinary & Hospitality" }),
    ],
  });

  assert.deepEqual(results.map((r) => r.workshop.id), ["next"]);
  assert.match(results[0].reasons[0], /Intro to Robotics/);
});

test("omits workshops with no evidence and honours the limit", () => {
  const results = recommend(
    {
      student,
      workshops: [
        workshop({ id: "a", title: "A Coding", category: "Technology" }),
        workshop({ id: "b", title: "B Coding", category: "Technology" }),
        workshop({ id: "c", title: "Pottery", category: "Design & Creativity" }),
      ],
    },
    { limit: 1 }
  );

  assert.deepEqual(results.map((r) => r.workshop.id), ["a"]);
});

test("validates input and weights", () => {
  assert.throws(() => recommend({ student: null }), /student profile/);
  assert.throws(
    () => recommend({ student: { interests: "coding" } }),
    /interests must be an array/
  );
  assert.throws(
    () =>
      recommend(
        { student },
        { weights: { ...WORKSHOP_RECOMMENDATION_WEIGHTS, learningMode: -1 } }
      ),
    /non-negative/
  );
  assert.throws(() => recommend({ student }, { limit: 0 }), /limit/);
});
