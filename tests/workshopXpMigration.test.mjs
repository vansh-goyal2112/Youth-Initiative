import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { automaticWorkshopXp, needsLegacyXpAssignment } from "../src/services/workshopXpAssignment.mjs";
const source = p => readFileSync(new URL(p, import.meta.url), "utf8");
test("historical 100 XP defaults qualify but staff values never change", () => {
  assert.equal(needsLegacyXpAssignment({ id:"a", importedFromExcel:true, xpReward:100 }), true);
  assert.equal(needsLegacyXpAssignment({ id:"a", importedFromExcel:true, xpReward:100, updatedBy:"staff" }), false);
  assert.equal(needsLegacyXpAssignment({ id:"a", importedFromExcel:true, xpReward:100, xpRewardSource:"import" }), false);
  assert.equal(needsLegacyXpAssignment({ id:"a", importedFromExcel:true, xpReward:175 }), false);
  assert.equal(automaticWorkshopXp("robotics"), automaticWorkshopXp("robotics"));
});
test("all catalogue routes and award routes resolve stored XP", () => {
  for (const p of ["../src/app/api/workshops/route.js","../src/app/api/admin/workshops/route.js","../src/app/api/workshops/self-report/route.js"])
    assert.match(source(p), /ensureWorkshopCatalogueXp/);
  for (const p of ["../src/app/api/workshops/[id]/route.js","../src/app/api/workshops/self-report/route.js","../src/app/api/attendance/verify/route.js","../src/app/api/gamification/reconcile/route.js"])
    assert.match(source(p), /ensureWorkshopXpAssigned/);
});
test("one-time migration uses fresh reads and ETag conflict handling, no student balance writes", () => {
  const s = source("../src/services/workshopXpMigration.js");
  assert.match(s, /readCosmosDocument\("workshops", workshop\.id\)/);
  assert.match(s, /replaceCosmosDocument\("workshops", current/);
  assert.match(s, /isCosmosPreconditionFailed/);
  assert.doesNotMatch(s, /xpTransactions|studentBadges|currentXp|totalXp/);
});
