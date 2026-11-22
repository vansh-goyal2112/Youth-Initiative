import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getConfiguredWorkshopXp } from "../src/utils/workshopXpDisplay.mjs";
const src = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Excel XP Reward and XP columns are read for individual workshops", () => {
  const admin = src("../src/app/admin/workshops/page.js");
  assert.match(admin, /row\["XP Reward"\]/);
  assert.match(admin, /row\["XP"\]/);
  assert.match(admin, /XP Reward \(for this experience\)/);
});

test("import validates staff-set XP and preserves custom awards on re-import", () => {
  const importer = src("../src/app/api/admin/workshops/import/route.js");
  assert.match(importer, /xpConfiguredByImport: workshop\.xpReward != null/);
  assert.match(importer, /workshopData\.xpConfiguredByImport/);
  assert.match(importer, /xpReward: workshopData\.xpReward/);
  assert.match(importer, /Number\.isInteger\(Number\(w\.xpReward\)\)/);
  assert.match(importer, /w\.xpReward \?\? null/);
});

test("catalogue and detail show the actual configured XP, not a hidden 100 fallback", () => {
  const card = src("../src/components/workshops/WorkshopCard.js");
  const detail = src("../src/app/workshops/[id]/page.js");
  for (const source of [card, detail]) {
    assert.match(source, /getConfiguredWorkshopXp\(workshop\)/);
    assert.match(source, /XP not set/);
    assert.doesNotMatch(source, /workshop\.xpReward\s*(?:\?\?|\|\|)\s*100/);
  }
  assert.match(src("../src/services/completionRules.mjs"), /workshop\?\.xpReward/);
});

test("workshop XP display uses the staff-configured value at any valid size", () => {
  for (const reward of [50, 75, 100, 175, 200, 1000, 2500, 100000]) {
    assert.equal(getConfiguredWorkshopXp({ xpReward: reward }), reward);
  }
  assert.equal(getConfiguredWorkshopXp({ xpReward: "175" }), 175);
  for (const reward of [null, undefined, "", 0, -1, 0.5, "invalid", 100001]) {
    assert.equal(getConfiguredWorkshopXp({ xpReward: reward }), null);
  }
  assert.equal(getConfiguredWorkshopXp({ id: "legacy-program" }), null);
});

test("student fetch bypasses old cache when staff changes workshop XP", () => {
  const page = src("../src/app/workshops/page.js");
  const detail = src("../src/app/workshops/[id]/page.js");
  assert.match(page, /studentFetch\("\/api\/workshops", \{ cache: "no-store" \}\)/);
  assert.match(detail, /\{ cache: "no-store" \}/);
  assert.match(src("../src/app/api/workshops/route.js"), /\.\.\.normalizedWorkshop/);
});

test("admin editor does not make 100 XP appear when none was configured", () => {
  const admin = src("../src/app/admin/workshops/page.js");
  assert.match(admin, /getConfiguredWorkshopXp\(workshop\) \?\? "Not set"/);
  assert.equal((admin.match(/getConfiguredWorkshopXp\(workshop\) \?\? ""/g) || []).length, 2);
  assert.doesNotMatch(admin, /workshop\.xpReward \?\? 100/);
  assert.match(src("../src/app/api/admin/workshops/route.js"), /xpReward: explicitlySetXp \? xpReward : automaticWorkshopXp\(workshopId\)/);
});
