import {
  assertValidSaitProgram,
  normalizeMatchText,
  textIncludesTerm,
} from "./saitProgramNormalization.js";

export const PROGRAM_RECOMMENDATION_WEIGHTS = Object.freeze({
  interestCategory: 25,
  interestSubject: 15,
  completedWorkshopCategory: 20,
  completedWorkshopTopic: 25,
  learningMode: 15,
});

export const SAIT_INTEREST_PATHWAY_MAPPINGS = Object.freeze({
  "artificial intelligence": {
    category: "Technology",
    subjects: ["artificial intelligence"],
  },
  aviation: {
    category: "Aviation",
    subjects: ["aviation"],
  },
  business: {
    category: "Business & Leadership",
    subjects: ["business"],
  },
  coding: {
    category: "Technology",
    subjects: ["coding", "programming"],
  },
  culinary: {
    category: "Culinary & Hospitality",
    subjects: ["culinary arts"],
  },
  design: {
    category: "Design & Creativity",
    subjects: ["design"],
  },
  health: {
    category: "Health",
    subjects: ["health"],
  },
  robotics: {
    category: "Technology",
    subjects: ["robotics"],
  },
  "skilled trades": {
    category: "Trades",
    subjects: ["trades"],
  },
});

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
    ...(Array.isArray(workshop.topics) ? workshop.topics : []),
    ...(Array.isArray(workshop.subjects) ? workshop.subjects : []),
    ...(Array.isArray(workshop.skills) ? workshop.skills : []),
  ]
    .filter((value) => typeof value === "string")
    .join(" ");
}

function getRecommendationReasons(
  program,
  student,
  interests,
  completedWorkshops,
  weights
) {
  let score = 0;
  const reasons = [];
  const matchedWorkshopIds = new Set();
  const programCategory = normalizeCategory(program.category);
  const relatedCategories = program.relatedWorkshopCategories.map(
    normalizeCategory
  );
  const relatedTopics = program.relatedWorkshopTopics;

  const categoryInterestMatch = interests.find((interest) => {
    const category =
      SAIT_INTEREST_PATHWAY_MAPPINGS[normalizeMatchText(interest)]?.category;
    return category && normalizeCategory(category) === programCategory;
  });

  if (categoryInterestMatch) {
    score += weights.interestCategory;
    reasons.push(`Matches your interest in ${categoryInterestMatch}`);
  }

  const subjectInterestMatch = interests
    .map((interest) => {
      const supportedSubjects =
        SAIT_INTEREST_PATHWAY_MAPPINGS[normalizeMatchText(interest)]
          ?.subjects || [normalizeMatchText(interest)];

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
    if (categoryWorkshop.id) {
      matchedWorkshopIds.add(categoryWorkshop.id);
    }
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
    if (topicWorkshopMatch.workshop.id) {
      matchedWorkshopIds.add(topicWorkshopMatch.workshop.id);
    }
    reasons.push(
      `Connects with ${topicWorkshopMatch.topic} topics from your learning journey`
    );
  }

  const studentLearningMode = student.learningMode;
  const programLearningMode = program.learningMode;
  const isKnownStudentMode = ["in-person", "online", "both"].includes(
    studentLearningMode
  );
  const isKnownProgramMode = ["in-person", "online", "hybrid"].includes(
    programLearningMode
  );
  const learningModeMatches =
    isKnownStudentMode &&
    isKnownProgramMode &&
    (
      studentLearningMode === "both" ||
      studentLearningMode === programLearningMode ||
      programLearningMode === "hybrid"
    );

  if (learningModeMatches) {
    score += weights.learningMode;
    reasons.push(
      studentLearningMode === "both"
        ? "Fits your preference to consider both online and in-person options"
        : programLearningMode === "hybrid"
          ? `Offers a hybrid option that includes your ${studentLearningMode} learning preference`
          : `Fits your ${studentLearningMode} learning preference`
    );
  }

  return {
    score: Math.min(100, Math.round(score)),
    reasons,
    matchedWorkshopIds: [...matchedWorkshopIds],
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

  if (
    student.interests !== undefined &&
    !Array.isArray(student.interests)
  ) {
    throw new Error("Student interests must be an array.");
  }

  const interests = student.interests || [];

  if (interests.some((interest) => typeof interest !== "string")) {
    throw new Error("Student interests must contain only strings.");
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
      const { score, reasons, matchedWorkshopIds } = getRecommendationReasons(
        program,
        student,
        interests,
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
        matchedWorkshopIds,
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
