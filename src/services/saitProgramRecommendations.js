import { getWorkshopGradeBounds, matchesStudentGrade, schoolGradeNumber } from "../utils/workshopGrades.mjs";

import {
  assertValidSaitProgram,
  findSaitCategory,
  getMatchedTopics,
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

// Bonus above the base 100 that ranks programs sharing the same category.
export const INTEREST_KEYWORD_BONUS = 10;

export const SAIT_INTEREST_PATHWAY_MAPPINGS = Object.freeze({
  "artificial intelligence": {
    category: "Technology",
    subjects: ["artificial intelligence", "ai"],
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
    subjects: ["coding", "programming", "software development"],
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
  const programText = [program.title, program.description].join(" ");
  const titleCategory = findSaitCategory(program.title);
  const programCategory = titleCategory === "General"
    ? findSaitCategory(program.description)
    : titleCategory;
  const categoryInterestMatch = interests.some((interest) =>
    SAIT_INTEREST_PATHWAY_MAPPINGS[normalizeMatchText(interest)]?.category === programCategory
  );

  const subjectMatches = interests.flatMap((interest) => {
    const terms = SAIT_INTEREST_PATHWAY_MAPPINGS[normalizeMatchText(interest)]?.subjects ||
      [normalizeMatchText(interest)];
    const titleTerm = terms.find((term) => textIncludesTerm(program.title, term));
    const term = titleTerm || terms.find((candidate) => textIncludesTerm(program.description, candidate));
    return term ? [{ term, points: titleTerm ? 1 : 0.5 }] : [];
  });
  subjectMatches.sort((first, second) => second.points - first.points);

  if (categoryInterestMatch) {
    score += weights.interestCategory;
  }

  if (subjectMatches.length > 0) {
    score += weights.interestSubject;
    const keywordPoints = subjectMatches.reduce((sum, match) => sum + match.points, 0);
    score += (INTEREST_KEYWORD_BONUS * keywordPoints) / interests.length;
  }

  const specificSubjects = subjectMatches.filter(({ term }) =>
    !categoryInterestMatch || term !== normalizeCategory(programCategory)
  );
  if (specificSubjects.length > 0) {
    for (const { term } of specificSubjects.slice(0, 2)) {
      const label = term === "ai" ? "artificial intelligence" : term;
      reasons.push(`Learn about ${label}.`);
    }
  } else if (categoryInterestMatch) {
    const area = { Trades: "the skilled trades", Health: "health care" }[programCategory] ||
      programCategory.toLowerCase();
    reasons.push(`Explore a SAIT program in ${area}.`);
  }

  // Stored tags can include words scraped from outside the program description.
  // Require a topic in both the program and the completed activity before naming it.
  const supportedTopics = new Set([
    ...getMatchedTopics(programText).map(({ label }) => label),
    ...program.relatedWorkshopTopics.filter((topic) => textIncludesTerm(programText, topic)),
  ]);
  const topicWorkshopMatch = completedWorkshops
    .map((workshop) => {
      const workshopText = getWorkshopText(workshop);
      const workshopTopics = new Set(getMatchedTopics(workshopText).map(({ label }) => label));
      return {
        workshop,
        topic: [...supportedTopics].find((topic) =>
          normalizeCategory(topic) !== normalizeCategory(programCategory) &&
          (workshopTopics.has(topic) || textIncludesTerm(workshopText, topic))
        ),
      };
    })
    .find(({ topic }) => Boolean(topic));

  if (topicWorkshopMatch) {
    const { workshop, topic } = topicWorkshopMatch;
    score += weights.completedWorkshopTopic;
    if (normalizeCategory(workshop.category) === normalizeCategory(programCategory) &&
        programCategory !== "General") {
      score += weights.completedWorkshopCategory;
    }
    if (workshop.id) {
      matchedWorkshopIds.add(workshop.id);
    }
    if (workshop.title) {
      reasons.push(`Keep exploring ${topic.toLowerCase()} after ${workshop.title}.`);
    } else {
      reasons.push(`Keep exploring ${topic.toLowerCase()} from an experience you completed.`);
    }
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

  // Delivery mode can boost an existing subject or history match.
  if (score > 0 && learningModeMatches) {
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
    directInterestCount: subjectMatches.length,
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

  const studentInterests = student.interests || [];

  if (studentInterests.some((interest) => typeof interest !== "string")) {
    throw new Error("Student interests must contain only strings.");
  }

  const interests = [...new Set(studentInterests.map((interest) => {
    const normalized = normalizeMatchText(interest);
    return normalized === "ai" ? "artificial intelligence" : normalized;
  }).filter(Boolean))];

  if (
    !Array.isArray(completedWorkshops) ||
    !Array.isArray(programs)
  ) {
    throw new Error(
      "Completed experiences and SAIT programs must be provided as arrays."
    );
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Recommendation limit must be a positive integer.");
  }

  validateWeights(weights);

  if (schoolGradeNumber(student.schoolGrade) === null) return [];

  return programs
    .filter((program) => {
      assertValidSaitProgram(program);
      // Future pathways without a published school-grade limit remain informational.
      // Explicit grade-limited SAIT offerings must match the student grade.
      return program.status === "active" &&
        (!getWorkshopGradeBounds(program) || matchesStudentGrade(program, student.schoolGrade));
    })
    .map((program) => {
      const { score, directInterestCount, reasons, matchedWorkshopIds } = getRecommendationReasons(
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
        directInterestCount,
        reasons,
        matchedWorkshopIds,
      };
    })
    .filter((recommendation) => recommendation.score > 0)
    .sort(
      (first, second) =>
        // Direct subject matches take priority over category, history and delivery preferences.
        second.directInterestCount - first.directInterestCount ||
        second.score - first.score ||
        first.program.title.localeCompare(second.program.title)
    )
    .slice(0, limit)
    .map(({ directInterestCount: _directInterestCount, ...recommendation }) => recommendation);
}
