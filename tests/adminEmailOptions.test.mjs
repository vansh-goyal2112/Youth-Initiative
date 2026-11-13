import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("admin account verification offers only Azure resend, not Firebase fallback", () => {
  const login = file("src/app/admin/login/page.js");
  assert.match(login, /Resend via Azure Email/);
  assert.match(login, /resendVerification/);
  assert.doesNotMatch(login, /Send with Firebase instead|sendFirebaseVerification|sendEmailVerification/);
});

test("admin recovery retains Azure-backed request, no Firebase email fallback control", () => {
  const login = file("src/app/admin/login/page.js");
  assert.match(login, /\/api\/admin\/password-reset\/request/);
  assert.match(login, /Send recovery email/);
  assert.doesNotMatch(login, /sendFirebaseReset|sendPasswordResetEmail|Firebase email option/);

  const request = file("src/app/api/admin/password-reset/request/route.js");
  const verification = file("src/app/api/admin/auth/send-verification/route.js");
  assert.match(request, /sendAzureEmail/);
  assert.match(verification, /sendAzureEmail/);
  assert.doesNotMatch(request + verification, /Send with Firebase instead|Firebase email option/);
});
