import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getXpBalances, redeemXp } from "../src/services/xpBalance.mjs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Badges & Rewards explains that students redeem XP in person at SAIT events", () => {
  const page = source("../src/app/badges/page.js");
  assert.match(page, /How rewards work/);
  assert.match(page, /Bring your XP to SAIT events\. Staff will show you the rewards available that day\./);
  assert.match(page, /SAIT staff will redeem it in person and subtract the required XP from your XP available to spend\./);
  assert.match(page, /Rewards vary by event, and online redemption is not available\./);
  assert.match(page, /XP available to spend/);
  assert.match(page, /Lifetime XP/);
});

test("spendable XP uses the current balance, while Lifetime XP sets the level", () => {
  const page = source("../src/app/badges/page.js");
  assert.match(page, /gameData\.currentXp \?\? gameData\.totalXp/);
  assert.match(page, /XP available to spend at SAIT events/);
  assert.match(page, /XP available to spend decreases when staff redeem rewards/);
  assert.match(page, /Lifetime XP tracks the XP you have earned and determines your level; redeeming rewards never reduces it/);
  assert.match(page, /If an incorrect workshop completion is reversed, staff may correct your earned XP/);
  const gamification = source("../src/app/api/gamification/route.js");
  assert.match(gamification, /getLevelInformation\(\s*totalXp\s*\)/);
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
