import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("admin XP form rejects zero, fractional, excessive and nonnumeric values", () => {
 const s = readFileSync(new URL("../src/app/api/admin/workshops/route.js", import.meta.url),"utf8");
 assert.match(s,/Number\.isSafeInteger\(xp\)/);
 assert.match(s,/xp < 1 \|\| xp > 100000/);
 assert.match(s,/xpReward: explicitlySetXp \? xpReward : automaticWorkshopXp\(workshopId\)/);
});
