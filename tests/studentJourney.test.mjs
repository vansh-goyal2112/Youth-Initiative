import assert from "node:assert/strict";
import test from "node:test";

import {
  getCompletedStudentWorkshops,
} from "../src/services/studentJourney.js";

test("loads only linked workshops from completed registrations", async () => {
  const queried = [];
  const read = [];
  const workshops = await getCompletedStudentWorkshops("student-1", {
    queryDocuments: async (...args) => {
      queried.push(args);
      return [
        { workshopId: "workshop-1" },
        { workshopId: "workshop-2" },
        {},
      ];
    },
    readDocument: async (...args) => {
      read.push(args);
      return args[1] === "workshop-1"
        ? { id: "workshop-1", title: "Coding" }
        : null;
    },
  });

  assert.equal(queried.length, 1);
  assert.equal(queried[0][0], "registrations");
  assert.match(queried[0][1], /c\.status = @status/);
  assert.deepEqual(queried[0][2], [
    { name: "@studentId", value: "student-1" },
    { name: "@status", value: "completed" },
  ]);
  assert.deepEqual(read, [
    ["workshops", "workshop-1"],
    ["workshops", "workshop-2"],
  ]);
  assert.deepEqual(workshops, [
    { id: "workshop-1", title: "Coding" },
  ]);
});

test("preserves multiple completed registrations for the same workshop", async () => {
  const workshops = await getCompletedStudentWorkshops("student-1", {
    queryDocuments: async () => [
      { workshopId: "workshop-1" },
      { workshopId: "workshop-1" },
    ],
    readDocument: async () => ({ id: "workshop-1", title: "Coding" }),
  });

  assert.equal(workshops.length, 2);
});

test("rejects missing student IDs or Cosmos readers", async () => {
  await assert.rejects(
    getCompletedStudentWorkshops("", {
      queryDocuments: async () => [],
      readDocument: async () => null,
    }),
    /student ID is required/
  );
  await assert.rejects(
    getCompletedStudentWorkshops("student-1", {}),
    /Cosmos query and document readers are required/
  );
});
