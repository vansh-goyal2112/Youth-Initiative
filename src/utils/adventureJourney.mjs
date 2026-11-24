import { countMatchingSessions } from "../services/customBadges.mjs";

const milestoneBadges = {
  "first-steps": "first-step",
  "skill-builder": "skill-builder",
  "curious-explorer": "curious-learner",
  "tech-journey": "tech-explorer",
  "workshop-champion": "workshop-champion",
};

const experienceLink = experience => `/workshops/${encodeURIComponent(experience.id)}`;

function badgeStop(badge, earned) {
  const { type, matchValue } = badge.rule;
  const target = badge.target;
  const unit = target === 1 ? "experience" : "experiences";
  const goal = type === "distinct_categories"
    ? `Explore ${target} different skill areas.`
    : matchValue
      ? `Complete ${target} ${unit} matching “${matchValue}”.`
      : `Complete ${target} ${unit}.`;
  return {
    id: `badge:${badge.id}`,
    title: badge.name,
    description: goal,
    current: earned ? target : badge.current,
    target,
    completed: earned,
    icon: "trophy",
  };
}

export function adventureJourney(gameData, recommendations, registrations = []) {
  const catalog = gameData.badgeCatalog || [];
  const definitions = new Map(catalog.map(badge => [badge.id, badge]));
  const earned = new Set([
    ...(gameData.earnedBadgeIds || []),
    ...(gameData.badges || []).map(badge => badge.badgeId || badge.id?.split("_").at(-1)),
  ]);

  const starterIds = new Set(Object.values(milestoneBadges));
  const quests = (gameData.quests || []).flatMap(quest => {
    const badge = definitions.get(milestoneBadges[quest.id]);
    if (!badge) return [quest];
    if (badge.status === "archived" && !earned.has(badge.id)) return [];
    return [{ ...badgeStop(badge, earned.has(badge.id)), id: quest.id, icon: quest.icon }];
  });
  const extras = catalog.filter(badge => !starterIds.has(badge.id));
  quests.push(...extras.filter(badge => earned.has(badge.id)).map(badge => badgeStop(badge, true)));
  if (quests.some(quest => !quest.completed)) return { quests };

  if (recommendations === null) return { quests };
  const matching = recommendations.filter(experience => experience.matchedInterests.length > 0);
  for (const experience of matching) {
    const badge = extras.find(item => item.status === "active" && !earned.has(item.id) &&
      item.current < item.target && item.rule.matchValue &&
      countMatchingSessions(item.rule, [{ status: "completed", workshopSnapshot: experience }]) > 0);
    if (badge) return {
      quests,
      nextStop: { ...badgeStop(badge, false), href: experienceLink(experience) },
    };
  }

  const completedIds = new Set(registrations.filter(item => item.status === "completed").map(item => item.workshopId));
  const experience = matching.find(item => !completedIds.has(item.id));
  return {
    quests,
    nextStop: experience ? {
      title: experience.title,
      description: "Attend this experience and check in to continue your journey.",
      href: experienceLink(experience),
    } : null,
  };
}
