/**
 * A verified workshop completion and its XP write live in separate Cosmos
 * documents. This classifier deliberately never grants XP when a transaction
 * already exists: a "processing" transaction may have credited the student
 * before its final status could be saved.
 */
export function classifyRewardRecovery(registration, transaction) {
  if (
    !registration ||
    registration.status !== "completed" ||
    registration.attendanceStatus !== "verified" ||
    !registration.workshopId
  ) {
    return "ineligible";
  }

  if (!transaction) {
    return "award";
  }

  return transaction.status === "completed" ? "synchronize" : "pending";
}

export function shouldShowQuestAsRewarded(quest) {
  return Boolean(quest?.completed);
}
