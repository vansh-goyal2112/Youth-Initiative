import test from "node:test";
import assert from "node:assert/strict";
import { getXpBalances, creditXp, redeemXp, reverseEarnedXp } from "../src/services/xpBalance.mjs";

test("legacy XP becomes spendable without changing lifetime XP", () => {
  assert.deepEqual(getXpBalances({ totalXp: 300 }), { totalXp: 300, currentXp: 300, xpCorrectionDebt: 0 });
});
test("spending never decreases Total XP", () => {
  assert.deepEqual(redeemXp({ totalXp: 300, currentXp: 300 }, 200), { totalXp: 300, currentXp: 100, xpCorrectionDebt: 0 });
  assert.throws(() => redeemXp({ totalXp: 300, currentXp: 100 }, 101), /Not enough/);
});
test("reversing previously spent XP produces an internal correction, never negative Current XP", () => {
  const state = reverseEarnedXp({ totalXp: 100, currentXp: 0 }, 100);
  assert.deepEqual(state, { totalXp: 0, currentXp: 0, xpCorrectionDebt: 100 });
  const later = creditXp(state, 40);
  assert.deepEqual(later, { totalXp: 40, currentXp: 0, xpCorrectionDebt: 60 });
  assert.deepEqual(creditXp(later, 90), { totalXp: 130, currentXp: 30, xpCorrectionDebt: 0 });
});
test("reversal first removes available Current XP then records the remainder as debt", () => {
  assert.deepEqual(reverseEarnedXp({ totalXp: 300, currentXp: 100 }, 200), { totalXp: 100, currentXp: 0, xpCorrectionDebt: 100 });
});
test("invalid fractional, zero, or excessive amounts are rejected", () => {
  assert.throws(() => creditXp({}, 0), RangeError);
  assert.throws(() => creditXp({}, 1.5), RangeError);
  assert.throws(() => reverseEarnedXp({ totalXp: 10 }, 11), RangeError);
});
