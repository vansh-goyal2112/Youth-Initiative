import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// User-facing wording only. Keep persisted records, CSS classes and component names stable.
const surfaces = [
  "../src/components/common/StudentHeader.jsx",
  "../src/app/LandingPage.jsx",
  "../src/app/admin/media/page.js",
  "../src/app/profile/page.js",
  "../src/app/dashboard/page.js",
  "../src/app/badges/page.js",
  "../src/app/journey/page.js",
  "../src/app/edit-profile/page.js",
  "../src/app/resume-registration/page.js",
  "../src/components/gamification/AdventureTrail.jsx",
  "../src/components/gamification/SkillQuestHub.jsx",
];

test("student and administrator user-facing copy uses Learning Journey", () => {
  for (const path of surfaces) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\bskill quest\b/i, path);
  }
  const header = readFileSync(new URL("../src/components/common/StudentHeader.jsx", import.meta.url), "utf8");
  assert.match(header, /LEARNING JOURNEY/);
  const landing = readFileSync(new URL("../src/app/LandingPage.jsx", import.meta.url), "utf8");
  assert.match(landing, /Learning Journey/);
  const admin = readFileSync(new URL("../src/app/admin/media/page.js", import.meta.url), "utf8");
  assert.match(admin, /Learning Journey welcome hero/);
});
