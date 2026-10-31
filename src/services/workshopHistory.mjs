// Immutable learning-history data detached from the catalogue document.
export function workshopCompletionSnapshot(workshop, registration, transaction) {
  if (!workshop?.id || !registration?.id || registration.status !== "completed") {
    throw new Error("A completed registration and matching workshop are required.");
  }
  if (registration.workshopId !== workshop.id) {
    throw new Error("Workshop/registration mismatch.");
  }
  return {
    id: workshop.id,
    title: workshop.title,
    programArea: workshop.programArea || "",
    offeringYear: workshop.offeringYear || (registration.completedAt ? new Date(registration.completedAt).getUTCFullYear() : null),
    category: workshop.category || "General",
    grade: workshop.grade || "",
    learningMode: workshop.learningMode || null,
    completedAt: registration.completedAt || registration.attendedAt || null,
    xpReward: transaction?.status === "completed"
      ? Number(transaction.points ?? workshop.xpReward ?? 100)
      : Number(workshop.xpReward ?? 100),
  };
}
