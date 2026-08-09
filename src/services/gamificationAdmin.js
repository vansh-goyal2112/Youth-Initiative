import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/services/firebaseAdmin";

function calculateLevel(totalXp) {
  if (totalXp >= 1000) return 6;
  if (totalXp >= 700) return 5;
  if (totalXp >= 450) return 4;
  if (totalXp >= 250) return 3;
  if (totalXp >= 100) return 2;

  return 1;
}

function getLevelName(level) {
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

export async function processWorkshopCompletion({
  studentId,
  workshopId,
  workshop,
}) {
  const studentReference = adminDb
    .collection("students")
    .doc(studentId);

  const studentSnapshot =
    await studentReference.get();

  if (!studentSnapshot.exists) {
    throw new Error("Student profile not found.");
  }

  const student = studentSnapshot.data();

  const xpReward =
    Number(workshop.xpReward) || 100;

  const currentXp =
    Number(student.totalXp) || 0;

  const newTotalXp =
    currentXp + xpReward;

  const newLevel =
    calculateLevel(newTotalXp);

  const completedWorkshopCount =
    (student.completedWorkshopCount || 0) + 1;

  const transactionId =
    `${studentId}_${workshopId}`;

  const xpReference = adminDb
    .collection("xpTransactions")
    .doc(transactionId);

  const existingXp =
    await xpReference.get();

  if (existingXp.exists) {
    return {
      xpEarned: 0,
      totalXp: currentXp,
      level: student.level || 1,
      levelName:
        getLevelName(student.level || 1),
      newBadges: [],
    };
  }

  const completedRegistrations =
    await adminDb
      .collection("registrations")
      .where("studentId", "==", studentId)
      .where("status", "==", "completed")
      .get();

  const completedCategories =
    new Set();

  for (
    const registrationDocument
    of completedRegistrations.docs
  ) {
    const registration =
      registrationDocument.data();

    const completedWorkshop =
      await adminDb
        .collection("workshops")
        .doc(registration.workshopId)
        .get();

    if (completedWorkshop.exists) {
      const category =
        completedWorkshop.data().category;

      if (category) {
        completedCategories.add(category);
      }
    }
  }

  if (workshop.category) {
    completedCategories.add(
      workshop.category
    );
  }

  const currentBadges =
    Array.isArray(student.badges)
      ? student.badges
      : [];

  const newBadges = [];

  function awardBadge(id, name) {
    if (!currentBadges.includes(id)) {
      currentBadges.push(id);

      newBadges.push({
        id,
        name,
      });
    }
  }

  if (completedWorkshopCount >= 1) {
    awardBadge(
      "first-step",
      "First Step"
    );
  }

  if (
    workshop.category === "Technology"
  ) {
    awardBadge(
      "tech-explorer",
      "Tech Explorer"
    );
  }

  if (completedWorkshopCount >= 3) {
    awardBadge(
      "skill-builder",
      "Skill Builder"
    );
  }

  if (completedCategories.size >= 3) {
    awardBadge(
      "curious-learner",
      "Curious Learner"
    );
  }

  if (completedWorkshopCount >= 5) {
    awardBadge(
      "workshop-champion",
      "Workshop Champion"
    );
  }

  const batch = adminDb.batch();

  batch.set(xpReference, {
    studentId,
    workshopId,

    action:
      "workshop_completion",

    points: xpReward,

    createdAt:
      FieldValue.serverTimestamp(),
  });

  batch.update(studentReference, {
    totalXp: newTotalXp,
    level: newLevel,
    levelName:
      getLevelName(newLevel),

    completedWorkshopCount,

    badgeCount:
      currentBadges.length,

    badges:
      currentBadges,

    updatedAt:
      FieldValue.serverTimestamp(),
  });

  for (const badge of newBadges) {
    const badgeReference =
      adminDb
        .collection("studentBadges")
        .doc(
          `${studentId}_${badge.id}`
        );

    batch.set(
      badgeReference,
      {
        studentId,

        badgeId:
          badge.id,

        name:
          badge.name,

        earnedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );
  }

  await batch.commit();

  return {
    xpEarned: xpReward,
    totalXp: newTotalXp,
    level: newLevel,
    levelName:
      getLevelName(newLevel),
    newBadges,
  };
}