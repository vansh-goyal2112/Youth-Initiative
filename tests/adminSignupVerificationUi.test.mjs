import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const login = readFileSync(new URL("../src/app/admin/login/page.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/admin/admin-design.css", import.meta.url), "utf8");

test("Azure resend is visible in request-access mode only, not before admin account creation", () => {
  assert.match(login, /mode === "request" && \(\s*<div className="admin-auth-verification-actions">/);
  assert.doesNotMatch(login, /\(mode === "request" \|\| mode === "register"\)/);
  assert.match(login, /setMode\("request"\)/);
  assert.match(login, /onClick=\{resendVerification\}/);
});

test("Resend action and its help text have dedicated non-overlapping responsive spacing", () => {
  assert.match(css, /\.admin-auth-verification-actions\{display:grid;gap:12px;margin-top:24px;/);
  assert.match(css, /\.admin-auth-verification-actions \.admin-auth-secondary\{margin-top:0;/);
  assert.match(css, /\.admin-auth-verification-actions \.admin-auth-hint\{margin-top:0;/);
  assert.match(login, /<span>Resend via Azure Email<\/span>/);
});
