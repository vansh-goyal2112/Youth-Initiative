import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getXpBalances, redeemXp } from "../src/services/xpBalance.mjs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Badges & Rewards explains that students redeem XP in person at SAIT events", () => {
  const page = source("../src/app/badges/page.js");
  assert.match(page, /How rewards work/);
  assert.match(page, /Bring your XP to SAIT events\. Staff will show you the rewards available that day\./);
  assert.match(page, /SAIT staff will redeem it in person and subtract the required XP from your Current XP balance\./);
  assert.match(page, /Rewards vary by event, and online redemption is not available\./);
  assert.match(page, /Current XP · Available to redeem/);
});

test("spendable Current XP uses the live gamification balance, not lifetime Total XP", () => {
  const page = source("../src/app/badges/page.js");
  assert.match(page, /gameData\.currentXp \?\? gameData\.totalXp/);
  assert.match(page, /Available to redeem at SAIT events/);
  assert.match(page, /Total XP tracks how much you have earned across your journey; Current XP is what you can still redeem\./);
  const student = { totalXp: 450, currentXp: 230 };
  assert.deepEqual(getXpBalances(student), {
    totalXp: 450, currentXp: 230, xpCorrectionDebt: 0,
  });
  assert.deepEqual(redeemXp(student, 100), {
    totalXp: 450, currentXp: 130, xpCorrectionDebt: 0,
  });
});

test("only staff can redeem rewards using the existing admin permissioned endpoint", () => {
  const api = source("../src/app/api/admin/rewards/route.js");
  assert.match(api, /requireAdminPermission\(request, "xp\.redeem"\)/);
  assert.match(api, /redeemXp\(fresh, amount\)/);
  const page = source("../src/app/badges/page.js");
  assert.doesNotMatch(page, /fetch\(["']\/api\/admin\/rewards/);
  assert.doesNotMatch(page, /studentFetch\(["']\/api\/admin\/rewards/);
  assert.match(page, /badgeCatalog\.map/);
});
