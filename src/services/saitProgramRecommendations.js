import {
  assertValidSaitProgram,
  normalizeMatchText,
  textIncludesTerm,
} from "./saitProgramNormalization.js";

export const PROGRAM_RECOMMENDATION_WEIGHTS = Object.freeze({
  interestCategory: 30,
  interestSubject: 20,
  completedWorkshopCategory: 25,
  completedWorkshopTopic: 25,
});

const INTEREST_CATEGORIES = {
  "artificial intelligence": "Technology",
  aviation: "Aviation",
  business: "Business & Leadership",
  coding: "Technology",
  culinary: "Culinary & Hospitality",
  design: "Design & Creativity",
  health: "Health",
  robotics: "Technology",
  "skilled trades": "Trades",
};

const INTEREST_SUBJECTS = {
  "artificial intelligence": ["artificial intelligence"],
  aviation: ["aviation"],
  business: ["business"],
  coding: ["coding", "programming"],
  culinary: ["culinary arts"],
  design: ["design"],
  health: ["health"],
  robotics: ["robotics"],
  "skilled trades": ["trades"],
};

function normalizeCategory(value) {
  return normalizeMatchText(value).replace(/\s/g, " ");
}

function validateWeights(weights) {
  const keys = Object.keys(PROGRAM_RECOMMENDATION_WEIGHTS);
  const total = keys.reduce((sum, key) => {
    const weight = weights[key];

    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(
        `Recommendation weight "${key}" must be a non-negative number.`
      );
    }

    return sum + weight;
  }, 0);

  if (total <= 0) {
    throw new Error("Recommendation weights must total more than zero.");
  }
}

function getWorkshopText(workshop) {
  return [
    workshop.title,
    workshop.description,
    workshop.category,
    workshop.programArea,
  ]
    .filter((value) => typeof value === "string")
    .join(" ");
}

function getRecommendationReasons(
  program,
  interests,
  completedWorkshops,
  weights
) {
  let score = 0;
  const reasons = [];
  const programCategory = normalizeCategory(program.category);
  const relatedCategories = program.relatedWorkshopCategories.map(
    normalizeCategory
  );
  const relatedTopics = program.relatedWorkshopTopics;

  const categoryInterestMatch = interests.find((interest) => {
    const category = INTEREST_CATEGORIES[normalizeMatchText(interest)];
    return category && normalizeCategory(category) === programCategory;
  });

  if (categoryInterestMatch) {
    score += weights.interestCategory;
    reasons.push(`Matches your interest in ${categoryInterestMatch}`);
  }

  const subjectInterestMatch = interests
    .map((interest) => {
      const supportedSubjects =
        INTEREST_SUBJECTS[normalizeMatchText(interest)] || [
          normalizeMatchText(interest),
        ];

      const programSubject = program.subjects.find((subject) =>
        supportedSubjects.some(
          (supportedSubject) =>
            normalizeMatchText(subject) ===
            normalizeMatchText(supportedSubject)
        )
      );

      return programSubject
        ? {
            interest,
            subject: programSubject,
          }
        : null;
    })
    .find(Boolean);

  if (subjectInterestMatch) {
    score += weights.interestSubject;
    reasons.push(
      `Connects your ${subjectInterestMatch.interest} interest with ${subjectInterestMatch.subject}`
    );
  }

  const categoryWorkshop = completedWorkshops.find((workshop) =>
    relatedCategories.includes(normalizeCategory(workshop.category))
  );

  if (categoryWorkshop) {
    score += weights.completedWorkshopCategory;
    reasons.push(
      `Builds on your completed ${categoryWorkshop.title} workshop`
    );
  }

  const topicWorkshopMatch = completedWorkshops
    .map((workshop) => ({
      workshop,
      topic: relatedTopics.find((topic) =>
        textIncludesTerm(getWorkshopText(workshop), topic)
      ),
    }))
    .find(({ topic }) => Boolean(topic));

  if (topicWorkshopMatch) {
    score += weights.completedWorkshopTopic;
    reasons.push(
      `Connects with ${topicWorkshopMatch.topic} topics from your learning journey`
    );
  }

  return {
    score: Math.min(100, Math.round(score)),
    reasons,
  };
}

export function recommendSaitPrograms(
  {
    student,
    completedWorkshops,
    programs,
  },
  {
    weights = PROGRAM_RECOMMENDATION_WEIGHTS,
    limit = 10,
  } = {}
) {
  if (!student || typeof student !== "object") {
    throw new Error("A student profile is required for recommendations.");
  }

  if (!Array.isArray(student.interests)) {
    throw new Error("Student interests must be an array.");
  }

  if (
    !Array.isArray(completedWorkshops) ||
    !Array.isArray(programs)
  ) {
    throw new Error(
      "Completed workshops and SAIT programs must be provided as arrays."
    );
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Recommendation limit must be a positive integer.");
  }

  validateWeights(weights);

  return programs
    .filter((program) => {
      assertValidSaitProgram(program);
      return program.status === "active";
    })
    .map((program) => {
      const { score, reasons } = getRecommendationReasons(
        program,
        student.interests,
        completedWorkshops,
        weights
      );

      return {
        program: {
          id: program.id,
          title: program.title,
          informationUrl: program.informationUrl,
        },
        score,
        reasons,
      };
    })
    .filter((recommendation) => recommendation.score > 0)
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.program.title.localeCompare(second.program.title)
    )
    .slice(0, limit);
}
