// Pure eligibility policy: never disclose a Youth ID to an unverified
// student contact or a guardian who did not complete parental consent.
const normalize = value => typeof value === "string" ? value.trim().toLowerCase() : "";
const active = student => student?.role === "student" &&
  student?.accountStatus === "active" &&
  typeof student?.id === "string" &&
  typeof student?.youthId === "string" &&
  student.youthId.trim().length > 0;

export function selectRecoverableYouthIds({ requestedEmail, contactEmailStudents = [], parentEmailStudents = [] }) {
  const address = normalize(requestedEmail);
  if (!address) return [];
  const eligible = new Map();
  for (const student of contactEmailStudents) {
    if (!active(student) || student.requiresParentalConsent === true ||
        student.contactEmailVerified !== true || normalize(student.contactEmail) !== address) continue;
    eligible.set(student.id, { firstName: student.firstName || "Student", youthId: student.youthId });
  }
  for (const student of parentEmailStudents) {
    if (!active(student) || student.requiresParentalConsent !== true ||
        student.consentStatus !== "approved" || normalize(student.parentEmail) !== address) continue;
    eligible.set(student.id, { firstName: student.firstName || "Student", youthId: student.youthId });
  }
  return [...eligible.values()];
}

export function youthIdRecoveryPlainText(accounts, appUrl) {
  const details = accounts.map(account => {
    const name = String(account.firstName || "Student").replace(/[\r\n\t]/g, " ").slice(0, 80);
    const youthId = String(account.youthId).replace(/[\r\n\t]/g, "").slice(0, 40);
    return name + ": " + youthId;
  }).join("\n");
  return [
    "SAIT Youth Initiatives — Your Youth ID",
    "",
    "You requested a reminder of the Youth ID associated with this verified email address:",
    details,
    "",
    "Sign in at: " + String(appUrl).replace(/\/$/, "") + "/login",
    "",
    "If you did not request this reminder, no action is needed.",
    "For assistance, contact youth.programs@sait.ca.",
  ].join("\n");
}
