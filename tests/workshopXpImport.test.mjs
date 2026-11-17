import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Excel XP Reward and XP columns are read for individual workshops", () => {
  const admin = src("../src/app/admin/workshops/page.js");
  assert.match(admin, /row\["XP Reward"\]/);
  assert.match(admin, /row\["XP"\]/);
  assert.match(admin, /XP Reward \(for this workshop\)/);
});

test("import validates staff-set XP and preserves custom awards on re-import", () => {
  const importer = src("../src/app/api/admin/workshops/import/route.js");
  assert.match(importer, /xpConfiguredByImport: workshop\.xpReward != null/);
  assert.match(importer, /workshopData\.xpConfiguredByImport/);
  assert.match(importer, /xpReward: workshopData\.xpReward/);
  assert.match(importer, /Number\.isInteger\(Number\(w\.xpReward\)\)/);
  assert.match(importer, /w\.xpReward \?\? null/);
});

test("workshop details do not override valid zero values with a truthy fallback", () => {
  const detail = src("../src/app/workshops/[id]/page.js");
  assert.match(detail, /workshop\.xpReward \?\? 100/);
  assert.doesNotMatch(detail, /workshop\.xpReward \|\| 100/);
});

test("student cards still use the stored workshop-specific reward", () => {
  assert.match(src("../src/components/workshops/WorkshopCard.js"), /workshop\.xpReward \?\? 100/);
  assert.match(src("../src/services/completionRules.mjs"), /workshop\?\.xpReward/);
});
