import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { automaticWorkshopXp, needsLegacyXpAssignment, WORKSHOP_XP_OPTIONS } from "../src/services/workshopXpAssignment.mjs";

test("automatic XP is stable, nonzero, and varied across workshop IDs", () => {
  const values = Array.from({ length: 100 }, (_, i) => automaticWorkshopXp("2027-test-program-" + i));
  assert.ok(new Set(values).size >= 4);
  assert.ok(values.every(value => WORKSHOP_XP_OPTIONS.includes(value)));
  assert.equal(automaticWorkshopXp("2027-test-program-1"), automaticWorkshopXp("2027-test-program-1"));
});
test("legacy assignment never replaces manually edited or configured rewards", () => {
  assert.equal(needsLegacyXpAssignment({ id: "a", importedFromExcel: true, xpReward: 100 }), true);
  assert.equal(needsLegacyXpAssignment({ id: "a", importedFromExcel: true, xpReward: 100, updatedBy: "staff" }), false);
  assert.equal(needsLegacyXpAssignment({ id: "a", importedFromExcel: false, xpReward: 100, xpRewardSource: "manual" }), false);
  assert.equal(needsLegacyXpAssignment({ id: "a", importedFromExcel: true, xpReward: 150 }), false);
});
test("imports, admin creation and SAIT scraper persist automatic awards", () => {
  const file = p => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.match(file("../src/app/api/admin/workshops/import/route.js"), /automaticWorkshopXp\(workshopId\)/);
  assert.match(file("../src/app/api/admin/workshops/route.js"), /automaticWorkshopXp\(workshopId\)/);
  assert.match(file("../src/services/saitWorkshopIngestion.js"), /automaticWorkshopXp\(createWorkshopId/);
  assert.match(file("../src/app/api/admin/workshops/auto-xp/route.js"), /requireAdminPermission\(request, "workshops.edit"\)/);
});
