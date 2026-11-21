/**
 * Only celebrate XP and newly awarded badges returned by the verified
 * attendance endpoint. Never imply an award that is still pending or a
 * transaction that returned zero new XP.
 */
export function attendanceCelebrationDetails(result) {
  const reward = result?.reward;
  const xpEarned = Number(reward?.xpEarned);
  const confirmedReward = !result?.rewardPending && Number.isFinite(xpEarned) && xpEarned > 0;
  return {
    confirmedReward,
    xpEarned: confirmedReward ? xpEarned : 0,
    newBadges: confirmedReward && Array.isArray(reward?.newBadges)
      ? reward.newBadges.filter(badge => badge?.id && badge?.name)
      : [],
  };
}
