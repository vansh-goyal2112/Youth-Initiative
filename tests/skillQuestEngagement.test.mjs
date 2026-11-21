import test from "node:test";
import assert from "node:assert/strict";
import { isValidQuestId, QUEST_IDS } from "../src/services/skillQuestEngagement.mjs";

test("saved Learning Journey milestone identifiers remain valid", () => {
  assert.equal(QUEST_IDS.length, 5);
  for (const questId of QUEST_IDS) assert.equal(isValidQuestId(questId), true);
  assert.equal(isValidQuestId("hack-admin"), false);
  assert.equal(isValidQuestId(null), false);
});
