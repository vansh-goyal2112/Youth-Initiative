import test from "node:test";
import assert from "node:assert/strict";
import { adventureJourney } from "../src/utils/adventureJourney.mjs";
import { recommendYouthWorkshops } from "../src/utils/youthWorkshopRecommendations.mjs";

const starterStops = ["first-steps", "skill-builder", "curious-explorer", "tech-journey", "workshop-champion"]
  .map(id => ({ id, completed: true }));
const badge = {
  id: "custom:ai", name: "AI Explorer", status: "active", target: 2, current: 1,
  rule: { type: "sessions_topic", matchValue: "AI", minCount: 2 },
};
const ai = { id: "ai intro", title: "AI Foundations", matchedInterests: ["technology"] };
const welding = { id: "welding", title: "Welding", matchedInterests: ["manufacturing"] };

test("The next badge stop follows the five completed milestones and links to a qualifying experience", () => {
  const result = adventureJourney({ quests: starterStops, badgeCatalog: [badge] }, [welding, ai]);
  assert.equal(result.quests.length, 5);
  assert.equal(result.nextStop.title, "AI Explorer");
  assert.equal(result.nextStop.current, 1);
  assert.equal(result.nextStop.href, "/workshops/ai%20intro");
});

test("An earned additional badge remains visible and the next eligible experience takes its place", () => {
  const gameData = { quests: starterStops, badgeCatalog: [{ ...badge, status: "archived" }], earnedBadgeIds: [badge.id] };
  const result = adventureJourney(gameData, [ai, welding], [{ workshopId: ai.id, status: "completed" }]);
  assert.equal(result.quests.at(-1).completed, true);
  assert.equal(result.quests.at(-1).title, badge.name);
  assert.equal(result.nextStop.title, welding.title);
  assert.equal(adventureJourney(gameData, []).nextStop, null);
  assert.equal(adventureJourney(gameData, null).nextStop, undefined);
});

test("An edited built-in uses the badge rule and issued award status on the map", () => {
  const tech = { ...badge, id: "tech-explorer", name: "Technology Explorer" };
  const result = adventureJourney({ quests: starterStops, badgeCatalog: [tech] }, [ai]);
  assert.equal(result.quests[3].title, tech.name);
  assert.equal(result.quests[3].target, 2);
  assert.equal(result.quests[3].completed, false);
  assert.equal(result.nextStop, undefined);
});

test("Journey can suggest an upcoming booking while regular recommendations still exclude it", () => {
  const options = {
    workshops: [{ ...ai, status: "active", interestTags: ["Technology"], minGrade: 6, maxGrade: 12 }],
    registrations: [{ workshopId: ai.id, status: "upcoming" }],
    student: { interests: ["Technology"], schoolGrade: "9" },
  };
  assert.deepEqual(recommendYouthWorkshops(options), []);
  assert.deepEqual(recommendYouthWorkshops({ ...options, includeUpcoming: true })[0].matchedInterests, ["technology"]);
});
