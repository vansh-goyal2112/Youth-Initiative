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
    // Preserve the image as it appeared when this workshop was completed.
    // Historical achievements must remain presentable after catalogue removal.
    image: workshop.image || null,
    imageAssetId: workshop.imageAssetId || null,
    imageStatus: workshop.imageStatus || null,
    completedAt: registration.completedAt || registration.attendedAt || null,
    xpReward: transaction?.status === "completed"
      ? Number(transaction.points ?? workshop.xpReward ?? 100)
      : Number(workshop.xpReward ?? 100),
  };
}

 
// Older completion snapshots were created without artwork. Use catalogue
// image metadata only as a visual fallback; never replace historical titles,
// earned XP or existing saved artwork with the current offering's values.
export function withCompletionArtwork(snapshot, catalogue) {
  if (!snapshot) return catalogue || null;
  if (snapshot.image) return snapshot;
  return {
    ...snapshot,
    image: catalogue?.image || null,
    imageAssetId: catalogue?.imageAssetId || snapshot.imageAssetId || null,
    imageStatus: catalogue?.imageStatus || snapshot.imageStatus || null,
  };
}
