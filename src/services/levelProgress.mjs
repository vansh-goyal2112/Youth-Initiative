// Shared level thresholds for both XP awards and student progress screens.
export function calculateLevel(totalXp) {
  if (totalXp >= 1000) return 6;
  if (totalXp >= 700) return 5;
  if (totalXp >= 450) return 4;
  if (totalXp >= 250) return 3;
  if (totalXp >= 100) return 2;

  return 1;
}

export function getLevelName(level) {
  const levels = {
    1: "New Explorer",
    2: "Skill Starter",
    3: "Future Creator",
    4: "Innovation Builder",
    5: "Pathway Explorer",
    6: "Youth Champion",
  };

  return levels[level] || "New Explorer";
}

export function getLevelInformation(totalXp) {
  const levels = [
    {
      level: 1,
      name: "New Explorer",
      minimumXp: 0,
      nextXp: 100,
    },

    {
      level: 2,
      name: "Skill Starter",
      minimumXp: 100,
      nextXp: 250,
    },

    {
      level: 3,
      name: "Future Creator",
      minimumXp: 250,
      nextXp: 450,
    },

    {
      level: 4,
      name: "Innovation Builder",
      minimumXp: 450,
      nextXp: 700,
    },

    {
      level: 5,
      name: "Pathway Explorer",
      minimumXp: 700,
      nextXp: 1000,
    },

    {
      level: 6,
      name: "Youth Champion",
      minimumXp: 1000,
      nextXp: null,
    },
  ];

  let currentLevel =
    levels[0];

  for (const level of levels) {
    if (
      totalXp >= level.minimumXp
    ) {
      currentLevel = level;
    }
  }

  let progressPercentage = 100;

  if (currentLevel.nextXp) {
    const levelRange =
      currentLevel.nextXp -
      currentLevel.minimumXp;

    const levelProgress =
      totalXp -
      currentLevel.minimumXp;

    progressPercentage = Math.min(
      100,
      Math.round(
        (levelProgress /
          levelRange) *
          100
      )
    );
  }

  return {
    ...currentLevel,
    progressPercentage,
  };
}
