// Pure XP balance rules. All amounts are non-negative whole numbers.
// A legacy student with no spendable-balance field starts at their saved totalXP.
function points(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0;
}

export function getXpBalances(student = {}) {
  const totalXp = points(student.totalXp);
  return {
    totalXp,
    currentXp: student.currentXp === undefined || student.currentXp === null
      ? totalXp
      : points(student.currentXp),
    xpCorrectionDebt: points(student.xpCorrectionDebt),
  };
}

function checkAmount(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError("XP amount must be a positive whole number.");
  }
  return value;
}

export function creditXp(student, amount) {
  checkAmount(amount);
  const previous = getXpBalances(student);
  const offset = Math.min(previous.xpCorrectionDebt, amount);
  return {
    totalXp: previous.totalXp + amount,
    currentXp: previous.currentXp + amount - offset,
    xpCorrectionDebt: previous.xpCorrectionDebt - offset,
  };
}

export function redeemXp(student, amount) {
  checkAmount(amount);
  const previous = getXpBalances(student);
  if (amount > previous.currentXp) {
    throw new RangeError("Not enough Current XP to redeem this amount.");
  }
  return { ...previous, currentXp: previous.currentXp - amount };
}

export function reverseEarnedXp(student, amount) {
  checkAmount(amount);
  const previous = getXpBalances(student);
  if (amount > previous.totalXp) {
    throw new RangeError("Cannot reverse more XP than the student's earned total.");
  }
  const spendableReduction = Math.min(previous.currentXp, amount);
  return {
    totalXp: previous.totalXp - amount,
    currentXp: previous.currentXp - spendableReduction,
    xpCorrectionDebt: previous.xpCorrectionDebt + amount - spendableReduction,
  };
}
