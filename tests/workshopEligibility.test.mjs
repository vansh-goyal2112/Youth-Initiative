import assert from "node:assert/strict";
import test from "node:test";

import { getWorkshopEligibility } from "../src/services/workshopEligibility.js";
import { registrationSchema } from "../src/validations/registrationSchema.js";

const TODAY = new Date("2026-10-24T12:00:00.000Z");

test("matches profile age and grade against published bounds", () => {
  const result = getWorkshopEligibility(
    {
      minAge: 10,
      maxAge: 16,
      minGrade: 6,
      maxGrade: 10,
    },
    {
      dateOfBirth: "2014-04-03",
      schoolGrade: "7",
    },
    TODAY
  );

  assert.equal(result.status, "eligible");
});

test("excludes students outside a published grade range", () => {
  const result = getWorkshopEligibility(
    {
      grade: "Grades 11 - 12",
      minGrade: null,
      maxGrade: null,
    },
    {
      dateOfBirth: "2010-04-03",
      schoolGrade: "10",
    },
    TODAY
  );

  assert.equal(result.status, "ineligible");
});

test("shows opportunities with unknown eligibility as unconfirmed", () => {
  const result = getWorkshopEligibility(
    {
      minGrade: 6,
      maxGrade: 12,
    },
    {
      dateOfBirth: "2010-04-03",
      schoolGrade: null,
    },
    TODAY
  );

  assert.equal(result.status, "unconfirmed");
});

test("does not show educator-only workshops to students", () => {
  const result = getWorkshopEligibility(
    { audience: "educators" },
    {
      dateOfBirth: "2010-04-03",
      schoolGrade: "10",
    },
    TODAY
  );

  assert.equal(result.status, "ineligible");
});

test("leaves opportunities with no published age or grade requirements unconfirmed", () => {
  const result = getWorkshopEligibility(
    {},
    {
      dateOfBirth: "2010-04-03",
      schoolGrade: "10",
    },
    TODAY
  );

  assert.equal(result.status, "unconfirmed");
});

test("requires a valid grade during student registration", async () => {
  const values = {
    firstName: "Sam",
    lastName: "Student",
    email: "sam@example.com",
    dateOfBirth: "2010-04-03",
    schoolGrade: "10",
    parentEmail: "parent@example.com",
  };

  const validated = await registrationSchema.validate(values);
  assert.equal(validated.schoolGrade, "10");
  await assert.rejects(
    registrationSchema.validate({ ...values, schoolGrade: "" }),
    /current school grade/i
  );
  await assert.rejects(
    registrationSchema.validate({ ...values, schoolGrade: undefined }),
    /current school grade/i
  );
  await assert.rejects(
    registrationSchema.validate({
      ...values,
      schoolGrade: "13",
    }),
    /valid current school grade/
  );
});

test("recognizes hyphenated and kindergarten grade ranges from the workshop catalogue", () => {
  assert.equal(getWorkshopEligibility({ grade: "Grades 6–9" }, { schoolGrade: "12" }, TODAY).status, "ineligible");
  assert.equal(getWorkshopEligibility({ grade: "K-6" }, { schoolGrade: "K" }, TODAY).status, "eligible");
  assert.equal(getWorkshopEligibility({ grade: "6 to 12" }, { schoolGrade: "12" }, TODAY).status, "eligible");
  assert.equal(getWorkshopEligibility({ grade: "Grade 6" }, { schoolGrade: "12" }, TODAY).status, "ineligible");
});
