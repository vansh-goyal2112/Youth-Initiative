import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { automaticWorkshopXp, needsLegacyXpAssignment, WORKSHOP_XP_OPTIONS } from "../src/services/workshopXpAssignment.mjs";
import { awardForCompletion } from "../src/services/completionRules.mjs";
import { creditXp, reverseEarnedXp } from "../src/services/xpBalance.mjs";
import { calculateLevel } from "../src/services/levelProgress.mjs";
import { countMatchingSessions } from "../src/services/customBadges.mjs";

test("automatic workshop XP is unchanged on any number of reloads", () => {
  for (const id of ["workshop-2026-robotics", "digital-youth-cybersecurity-2027", "workshop-100"]) {
    const assigned = automaticWorkshopXp(id);
    const persisted = { id, importedFromExcel: true, xpReward: assigned, xpRewardSource: "automatic" };
    assert.ok(WORKSHOP_XP_OPTIONS.includes(assigned));
    for (let refresh = 0; refresh < 100; refresh += 1) {
      assert.equal(automaticWorkshopXp(id), assigned);
      assert.equal(needsLegacyXpAssignment(persisted), false);
    }
  }
  assert.equal(needsLegacyXpAssignment({ id: "staff-set", xpReward: 100, xpRewardSource: "manual", importedFromExcel: true }), false);
  assert.equal(needsLegacyXpAssignment({ id: "staff-edited", xpReward: 100, updatedBy: "admin", importedFromExcel: true }), false);
});

test("awards the stored workshop value and maintains cumulative balances, level and reversals", () => {
  const a = { id: "a", xpReward: 175 };
  const b = { id: "b", xpReward: 100 };
  let balance = creditXp({ totalXp: 0, currentXp: 0 }, awardForCompletion(a, "qr"));
  balance = creditXp(balance, awardForCompletion(b, "qr"));
  assert.equal(balance.totalXp, 275);
  assert.equal(balance.currentXp, 275);
  assert.equal(calculateLevel(balance.totalXp), 3);
  balance = reverseEarnedXp(balance, 175);
  assert.equal(balance.totalXp, 100);
  assert.equal(calculateLevel(balance.totalXp), 2);
  const self = awardForCompletion(a, "self_reported");
  assert.equal(self, 87);
  balance = creditXp(balance, self);
  assert.equal(balance.totalXp, 187);
});

test("custom Badge progress uses attached workshop snapshots for topic matching", () => {
  const route = readFileSync(new URL("../src/app/api/gamification/route.js", import.meta.url), "utf8");
  assert.match(route, /completedWithSnapshots\.push\(\{ \.\.\.batch\[index\], workshopSnapshot: workshop \}\)/);
  assert.match(route, /countMatchingSessions\(definition\.rule, completedWithSnapshots\)/);
  const records = [
    { status:"completed", workshopSnapshot:{ title:"Robotics 101", category:"Technology" } },
    { status:"completed", workshopSnapshot:{ title:"Robotics 201", category:"Technology" } },
  ];
  assert.equal(countMatchingSessions({type:"sessions_topic",matchValue:"robotics"},records),2);
  assert.equal(countMatchingSessions({type:"sessions_program_area",matchValue:"Technology"},records),0);
});

test("awards do not rerandomize on the read path or modify student XP during catalogue migration", () => {
  const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
  const migration = read("../src/services/workshopXpMigration.js");
  assert.match(migration, /if \(!needsLegacyXpAssignment\(workshop\)\) return workshop/);
  assert.match(migration, /xpRewardSource: "automatic"/);
  assert.doesNotMatch(migration, /replaceCosmosDocument\("students"|createCosmosDocument\("xpTransactions"/);
  const processor = read("../src/services/gamificationAdmin.js");
  assert.match(processor, /awardForCompletion\(workshop, completionSource\)/);
  assert.match(processor, /creditXp\(student, xpReward\)/);
  assert.match(processor, /points:\s*xpReward/);
});

test("one thousand new workshops have varied stable XP without changing existing staff values", () => {
  const counts = new Set();
  for (let i = 0; i < 1000; i += 1) {
    const id = `new-workshop-${i}`;
    const reward = automaticWorkshopXp(id);
    assert.ok(WORKSHOP_XP_OPTIONS.includes(reward));
    assert.equal(automaticWorkshopXp(id), reward);
    assert.equal(needsLegacyXpAssignment({id, xpReward: reward, xpRewardSource: "automatic", importedFromExcel: true}), false);
    counts.add(reward);
  }
  assert.equal(counts.size, WORKSHOP_XP_OPTIONS.length);
  assert.equal(needsLegacyXpAssignment({id:"staff", xpReward:175, xpRewardSource:"manual", importedFromExcel:true}), false);
  assert.equal(awardForCompletion({xpReward:175}, "qr"), 175);
  assert.equal(awardForCompletion({xpReward:175}, "self_reported"), 87);
});

test("catalogue replacement checks each completed scheduled session's XP transaction", () => {
  const importRoute = readFileSync(new URL("../src/app/api/admin/workshops/import/route.js", import.meta.url), "utf8");
  const retirement = readFileSync(new URL("../src/services/workshopRetirement.js", import.meta.url), "utf8");
  assert.match(importRoute, /completionTransactionId\(completion\.studentId, old\.id, completion\.sessionId \|\| null\)/);
  assert.match(retirement, /completionTransactionId\(registration\.studentId, id, registration\.sessionId \|\| null\)/);
  assert.doesNotMatch(importRoute, /\`\$\{completion\.studentId\}_\$\{old\.id\}\`/);
});
