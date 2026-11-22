import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getWorkshopCatalogueViewState } from "../src/utils/workshopCatalogueView.mjs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const authenticated = {
  authLoading: false,
  authenticated: true,
  loading: false,
  loadedForKey: "student-1:8",
  sessionKey: "student-1:8",
  schoolGrade: "8",
};

test("direct navigation and refresh remain loading while Firebase session is restoring", () => {
  assert.equal(getWorkshopCatalogueViewState(), "loading");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, authLoading: true }), "loading");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, loading: true }), "loading");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, loadedForKey: null }), "loading");
});

test("signed-out students see a login prompt only after auth has resolved", () => {
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, authenticated: false }), "login");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, authenticated: false, authLoading: true }), "loading");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, authenticated: false, errorMessage: "Bad token" }), "login");
});

test("never display a prior user's or prior grade's workshops", () => {
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, sessionKey: "student-2:8" }), "loading");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, sessionKey: "student-1:9" }), "loading");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, sessionKey: null }), "loading");
});

test("missing or invalid saved grade gets an identity prompt rather than zero results", () => {
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, schoolGrade: null, loadedForKey: "student-1:", sessionKey: "student-1:" }), "grade");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, schoolGrade: "13" }), "grade");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, gradeRequired: true }), "grade");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, schoolGrade: "K" }), "ready");
});

test("errors can be retried, but only a completed valid request may display the catalogue", () => {
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, errorMessage: "Network failed" }), "error");
  assert.equal(getWorkshopCatalogueViewState({ ...authenticated, errorMessage: "Network failed", loading: true }), "loading");
  assert.equal(getWorkshopCatalogueViewState(authenticated), "ready");
});

test("Workshops page defers request until verified auth, prevents stale writes, and provides usable states", () => {
  const page = read("../src/app/workshops/page.js");
  assert.match(page, /useAuth\(\)/);
  assert.match(page, /if \(authLoading\) return;/);
  assert.ok(page.indexOf("if (!user)") < page.indexOf('studentFetch("/api/workshops"'));
  assert.match(page, /\[authLoading, user, sessionKey, retryKey\]/);
  assert.match(page, /cancelled = true;/);
  assert.match(page, /if \(cancelled\) return;/);
  assert.match(page, /setGradeRequired\(data\.gradeRequired === true\)/);
  assert.match(page, /if \(!Array\.isArray\(data\?\.workshops\)\)/);
  assert.match(page, /if \(viewState !== "ready"\)/);
  assert.ok(page.indexOf('if (viewState !== "ready")') < page.indexOf("<strong>{filteredWorkshops.length}</strong>"));
  assert.match(page, /Log in to view experiences/);
  assert.match(page, /href="\/login"/);
  assert.match(page, /Add your school grade/);
  assert.match(page, /href="\/edit-profile"/);
  assert.match(page, /setRetryKey\(key => key \+ 1\)/);
  assert.match(page, /cache: "no-store"/);
  assert.doesNotMatch(page, /loadWorkshops\(\);\s*\}, \[\]\);/);
});

test("normal catalogue, registration, half-XP and closed-program rules are unchanged", () => {
  const page = read("../src/app/workshops/page.js");
  assert.match(page, /groupWorkshopsByAvailability\(filteredWorkshops\)/);
  assert.match(page, /matchesWorkshopGrade\(workshop, gradeFilter\)/);
  assert.match(page, /closedWorkshops\.map/);
  assert.match(page, /Previously Completed/);
  assert.match(read("../src/app/api/workshops/route.js"), /matchesStudentGrade\(workshop, student\.schoolGrade\)/);
  assert.match(read("../src/app/api/registrations/route.js"), /workshop\.availabilityStatus === "closed"/);
  assert.match(read("../src/app/api/workshops/self-report/route.js"), /awardForCompletion\(workshop, "self_reported"\)/);
});
