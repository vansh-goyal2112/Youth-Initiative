import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getClaimedWorkshopIds, getSelfClaimCategory } from "../src/utils/workshopSelfClaim.mjs";
import { awardForCompletion } from "../src/services/completionRules.mjs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("one claimed session blocks its entire program, not only the claimed date", () => {
  const registrations = [
    {workshopId: "robotics", sessionId: "morning", status: "completed", completionSource: "self_reported"},
    {workshopId: "robotics", sessionId: "evening", status: "upcoming"},
    {workshopId: "other", sessionId: "evening", status: "upcoming"},
  ];
  const ids = getClaimedWorkshopIds(registrations);
  assert.deepEqual([...ids], ["robotics"]);
  assert.equal(ids.has("robotics"), true);
  assert.equal(ids.has("other"), false);
  assert.equal(registrations[1].status, "upcoming"); // No mutation of registrations.
});

test("QR-verified, approved, pending, reversed and legacy claims remain excluded", () => {
  const ids = getClaimedWorkshopIds([
    {workshopId: "qr", status: "completed", completionSource: "qr", attendanceStatus: "verified"},
    {workshopId: "approved", status: "completed", completionSource: "self_reported", reviewStatus: "approved"},
    {workshopId: "pending", status: "completed", reviewStatus: "pending_review"},
    {workshopId: "reversed", status: "reversed", reviewStatus: "reversed"},
    {workshopId: "legacyQR", status: "upcoming", attendanceStatus: "verified"},
    {workshopId: "legacyClaim", status: "upcoming", attendanceStatus: "self_reported"},
    {workshopId: "reviewOnly", status: "upcoming", reviewStatus: "pending_review"},
    {workshopId: "upcoming", status: "upcoming"},
    {workshopId: "cancelled", status: "cancelled"},
  ]);
  for (const id of ["qr","approved","pending","reversed","legacyQR","legacyClaim","reviewOnly"]) {
    assert.equal(ids.has(id), true, id);
  }
  assert.equal(ids.has("upcoming"), false);
  assert.equal(ids.has("cancelled"), false);
});

test("invalid records don't cause claims to be hidden", () => {
  assert.deepEqual([...getClaimedWorkshopIds()], []);
  assert.deepEqual([...getClaimedWorkshopIds(null)], []);
  assert.deepEqual([...getClaimedWorkshopIds([
    null, {}, {status:"completed"}, {workshopId:"",status:"completed"},
    {workshopId:"  ",status:"completed"},
    {workshopId:"available",status:"upcoming"},
  ])], []);
});

test("server GET hides already-claimed programs; server POST rejects second claims across sessions", () => {
  const api = source("../src/app/api/workshops/self-report/route.js");
  assert.match(api, /const claimedWorkshops = getClaimedWorkshopIds\(registrations\)/);
  assert.match(api, /!claimedWorkshops\.has\(item\.id\)/);
  assert.match(api, /getClaimedWorkshopIds\(registrations\)\.has\(workshopId\)/);
  assert.match(api, /alreadyClaimed: true/);
  assert.match(api, /status: 409/);
  assert.match(api, /readCosmosDocument\("xpTransactions", transactionId\)/);
  assert.match(api, /isCosmosConflict\(error\) \|\| isCosmosPreconditionFailed\(error\)/);
  assert.match(api, /c\.studentId = @studentId AND c\.workshopId = @workshopId/);
  assert.match(api, /value: uid/);
  assert.doesNotMatch(api, /claimed\.has\(item\.id \+ ":" \+ session\.id\)/);
});

test("successful or stale claims remove the whole workshop from the dropdown immediately", () => {
  const component = source("../src/components/workshops/SelfReportWorkshop.jsx");
  assert.match(component, /setWorkshops\(current => current\.filter\(item => item\.id !== selected\)\)/);
  assert.equal((component.match(/setWorkshops\(current => current\.filter\(item => item\.id !== selected\)\)/g) || []).length, 2);
  assert.match(component, /response\.status === 409 && result\.alreadyClaimed === true/);
  assert.doesNotMatch(component, /const remaining = item\.sessions\.filter/);
  assert.match(component, /setSelected\(""\); setSessionId\(""\); setCompletedOn\(""\); setConfirmed\(false\)/);
});

test("historical grade and outreach access, half XP, QR and reversal rules remain unchanged", () => {
  const younger = {grade:"Grade 1", title:"Junior programming"};
  const outreach = {title:"1-Day On-campus Activities"};
  assert.equal(getSelfClaimCategory(younger,"8"), "earlier");
  assert.equal(getSelfClaimCategory(outreach,"8"), "outreach");
  assert.equal(awardForCompletion({xpReward:175}, "self_reported"),87);
  assert.equal(awardForCompletion({xpReward:175}, "qr"),175);
  const api = source("../src/app/api/workshops/self-report/route.js");
  assert.match(api, /getSelfClaimCategory\(item, student\.schoolGrade\)/);
  assert.match(api, /!getSelfClaimCategory\(workshop, student\.schoolGrade\)/);
  assert.match(api, /reviewStatus: "pending_review"/);
  assert.match(api, /processWorkshopCompletion\(\{/);
  assert.match(api, /consumeAppCheck: true/);
});
