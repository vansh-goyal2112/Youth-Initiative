import test from "node:test";
import assert from "node:assert/strict";
import { adminResetActionUrl, isValidAdminRecoveryPassword } from "../src/services/adminPasswordRecovery.mjs";

test("admin recovery routes a Firebase one-time code to the admin-only reset screen", () => {
  const firebase = "https://example.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=abc%2Bdef&apiKey=public";
  const result = new URL(adminResetActionUrl(firebase, "https://youth.example.ca"));
  assert.equal(result.origin, "https://youth.example.ca");
  assert.equal(result.pathname, "/admin/reset-password");
  assert.equal(result.searchParams.get("oobCode"), "abc+def");
  assert.equal(result.searchParams.has("apiKey"), false);
});
test("recovery refuses the wrong Firebase action or unsafe redirect hosts", () => {
  const valid = "https://example.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=securecode";
  assert.throws(() => adminResetActionUrl(valid, "http://evil.example.com"), /not safe/);
  assert.throws(() => adminResetActionUrl(valid, ""), /must be configured/);
  assert.throws(() => adminResetActionUrl("https://example.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=abc", "https://youth.example.ca"), /password-reset/);
  assert.throws(() => adminResetActionUrl("https://example.firebaseapp.com/__/auth/action?mode=resetPassword", "https://youth.example.ca"), /action code/);
});
test("admin reset password requires the same complexity as admin registration", () => {
  assert.equal(isValidAdminRecoveryPassword("RecoveryPass123!"), true);
  assert.equal(isValidAdminRecoveryPassword("short1A!"), false);
  assert.equal(isValidAdminRecoveryPassword("nopunctuation123A"), false);
  assert.equal(isValidAdminRecoveryPassword("nouppercase123!"), false);
  assert.equal(isValidAdminRecoveryPassword("NOLOWERCASE123!"), false);
  assert.equal(isValidAdminRecoveryPassword("NoDigitsHere!!"), false);
});
