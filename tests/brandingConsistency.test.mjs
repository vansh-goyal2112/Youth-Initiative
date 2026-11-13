import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const absolute = join(dir, item.name);
    if (item.isDirectory()) return sourceFiles(absolute);
    return [".js", ".jsx", ".mjs", ".ts", ".tsx", ".webmanifest"].includes(extname(item.name))
      ? [absolute] : [];
  });
}

test("student and administrator UI, APIs and email templates use plural Youth Initiatives branding", () => {
  const paths = ["src/app", "src/components", "src/services"]
    .flatMap(path => sourceFiles(join(root, path)));
  const singularLabels = [];
  for (const path of paths) {
    const content = readFileSync(path, "utf8");
    // Technical slugs such as youth-initiative-dev and YouthInitiative are
    // intentionally excluded: they are stable resource identifiers, not branding.
    if (/\bYouth\s+Initiative\b(?!s)/i.test(content)) {
      singularLabels.push(path.slice(root.length));
    }
  }
  assert.deepEqual(singularLabels, []);
});

test("app launcher and landing-page branding use the plural name", () => {
  const manifest = JSON.parse(readFileSync(join(root, "src/app/manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "SAIT Youth Initiatives");
  assert.equal(manifest.short_name, "Youth Initiatives");
  const home = readFileSync(join(root, "src/app/page.js"), "utf8");
  assert.doesNotMatch(home, /^\s*Initiative\s*$/m);
});
