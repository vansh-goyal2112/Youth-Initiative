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

test("all admin login modes put bottom actions below the form in a dedicated stack", () => {
  assert.match(login, /<\/form>\s*<div className="admin-auth-actions-stack">/);
  assert.match(css, /\.admin-auth-actions-stack\{display:grid;gap:16px;margin-top:20px\}/);
  assert.match(css, /\.admin-auth-form \.admin-auth-hint\{margin:0;/);
  assert.match(css, /\.admin-auth-actions-stack>\.admin-auth-hint\{margin:0;/);
  assert.match(css, /\.admin-auth-actions-stack \.admin-auth-back\{[^}]*margin:0;/);
  assert.match(css, /\.admin-auth-actions-stack \.admin-auth-trust\{[^}]*margin-top:8px;/);
});

test("long action labels and feedback messages wrap without overlapping icons or adjacent text", () => {
  assert.match(login, /<span className="admin-auth-submit-label">\{content.action\}<\/span>/);
  assert.match(css, /\.admin-auth-submit \.admin-auth-submit-label\{flex:1;min-width:0\}/);
  assert.match(css, /\.admin-auth-submit svg:first-child,\.admin-auth-submit svg:last-child\{margin:0;flex-shrink:0\}/);
  assert.match(css, /\.admin-auth-alert\{min-width:0;align-items:flex-start;overflow-wrap:anywhere;/);
  assert.match(css, /\.admin-auth-tabs button\{line-height:1.45;white-space:normal;overflow-wrap:anywhere\}/);
});
