import {
  normalizeMatchText,
  textIncludesTerm,
} from "./saitProgramNormalization.js";
import {
  SAIT_INTEREST_PATHWAY_MAPPINGS,
} from "./saitProgramRecommendations.js";
import {
  getWorkshopEligibility,
} from "./workshopEligibility.js";

export const WORKSHOP_RECOMMENDATION_WEIGHTS = Object.freeze({
  interestCategory: 30,
  interestTopic: 20,
  completedWorkshopCategory: 20,
  completedWorkshopTopic: 15,
  learningMode: 15,
});

function validateWeights(weights) {
  const total = Object.keys(WORKSHOP_RECOMMENDATION_WEIGHTS).reduce(
    (sum, key) => {
      const weight = weights[key];

      if (!Number.isFinite(weight) || weight < 0) {
        throw new Error(
          `Recommendation weight "${key}" must be a non-negative number.`
        );
      }

      return sum + weight;
    },
    0
  );

  if (total <= 0) {
    throw new Error("Recommendation weights must total more than zero.");
  }
}

function getWorkshopText(workshop) {
  return [workshop.title, workshop.description, workshop.programArea]
    .filter((value) => typeof value === "string")
    .join(" ");
}

function scoreWorkshop(workshop, student, interests, completedWorkshops, weights) {
  let score = 0;
  const reasons = [];
  const workshopCategory = normalizeMatchText(workshop.category);
  const workshopText = getWorkshopText(workshop);

  const categoryInterest = interests.find((interest) => {
    const category =
      SAIT_INTEREST_PATHWAY_MAPPINGS[normalizeMatchText(interest)]?.category;
    return category && normalizeMatchText(category) === workshopCategory;
  });

  if (categoryInterest) {
    score += weights.interestCategory;
    reasons.push(`Matches your interest in ${categoryInterest}`);
  }

  const topicInterest = interests.find((interest) => {
    const terms = [
      normalizeMatchText(interest),
      ...(SAIT_INTEREST_PATHWAY_MAPPINGS[normalizeMatchText(interest)]
        ?.subjects || []),
    ];
    return terms.some((term) => textIncludesTerm(workshopText, term));
  });

  if (topicInterest) {
    score += weights.interestTopic;
    reasons.push(`Covers topics related to your ${topicInterest} interest`);
  }

  const sameCategoryWorkshop = completedWorkshops.find(
    (completed) =>
      workshopCategory &&
      normalizeMatchText(completed.category) === workshopCategory
  );

  if (sameCategoryWorkshop) {
    score += weights.completedWorkshopCategory;
    reasons.push(
      `Continues from your completed ${sameCategoryWorkshop.title} workshop`
    );
  }

  const sharedTopicWorkshop = completedWorkshops.find(
    (completed) =>
      completed !== sameCategoryWorkshop &&
      [completed.programArea]
        .filter(Boolean)
        .some((area) => textIncludesTerm(workshopText, area))
  );

  if (sharedTopicWorkshop) {
    score += weights.completedWorkshopTopic;
    reasons.push(
      `Builds on the ${sharedTopicWorkshop.programArea} area you've explored`
    );
  }

  const studentMode = student.learningMode;
  const workshopMode = workshop.learningMode;
  const knownStudentMode = ["in-person", "online", "both"].includes(
    studentMode
  );
  const knownWorkshopMode = ["in-person", "online", "hybrid"].includes(
    workshopMode
  );

  if (
    knownStudentMode &&
    knownWorkshopMode &&
    (studentMode === "both" ||
      studentMode === workshopMode ||
      workshopMode === "hybrid")
  ) {
    score += weights.learningMode;
    reasons.push(
      studentMode === "both"
        ? "Fits your preference to consider both online and in-person options"
        : `Fits your ${studentMode} learning preference`
    );
  }

  return { score: Math.min(100, Math.round(score)), reasons };
}

export function recommendWorkshops(
  {
    student,
    completedWorkshops,
    registeredWorkshopIds = [],
    workshops,
  },
  {
    weights = WORKSHOP_RECOMMENDATION_WEIGHTS,
    limit = 10,
    today = new Date(),
  } = {}
) {
  if (!student || typeof student !== "object") {
    throw new Error("A student profile is required for recommendations.");
  }

  if (student.interests !== undefined && !Array.isArray(student.interests)) {
    throw new Error("Student interests must be an array.");
  }

  const interests = student.interests || [];

  if (interests.some((interest) => typeof interest !== "string")) {
    throw new Error("Student interests must contain only strings.");
  }

  if (!Array.isArray(completedWorkshops) || !Array.isArray(workshops)) {
    throw new Error(
      "Completed workshops and workshops must be provided as arrays."
    );
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Recommendation limit must be a positive integer.");
  }

  validateWeights(weights);

  const excludedIds = new Set([
    ...completedWorkshops.map((workshop) => workshop.id),
    ...registeredWorkshopIds,
  ]);

  return workshops
    .filter(
      (workshop) =>
        workshop.status === "active" &&
        !excludedIds.has(workshop.id) &&
        getWorkshopEligibility(workshop, student, today).status !==
          "ineligible"
    )
    .map((workshop) => {
      const { score, reasons } = scoreWorkshop(
        workshop,
        student,
        interests,
        completedWorkshops,
        weights
      );

      return {
        workshop: {
          id: workshop.id,
          title: workshop.title,
          category: workshop.category ?? null,
          informationUrl: workshop.informationUrl ?? null,
          registrationUrl: workshop.registrationUrl ?? null,
        },
        score,
        reasons,
      };
    })
    .filter((recommendation) => recommendation.score > 0)
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.workshop.title.localeCompare(second.workshop.title)
    )
    .slice(0, limit);
}
