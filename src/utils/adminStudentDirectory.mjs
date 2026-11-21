import { completionTransactionId } from "../services/completionRules.mjs";

function identityKey(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
    : "";
}

export function getPossibleDuplicateAccounts(students, pendingEnrollments) {
  const records = [
    ...students.map(student => ({
      key: "student:" + student.id,
      name: student.fullName || [student.firstName, student.lastName].filter(Boolean).join(" "),
      email: student.contactEmail,
    })),
    ...pendingEnrollments.map(item => ({
      key: "pending:" + item.id, name: item.fullName, email: item.email,
    })),
  ];
  const flags = new Map();
  for (const field of ["name", "email"]) {
    const groups = new Map();
    for (const record of records) {
      const value = identityKey(record[field]);
      if (!value) continue;
      const group = groups.get(value) || new Set();
      group.add(record.key);
      groups.set(value, group);
    }
    for (const group of groups.values()) {
      if (group.size < 2) continue;
      for (const key of group) flags.set(key, [...(flags.get(key) || []), field]);
    }
  }
  return flags;
}

export function summarizeStudentWorkshopHistory(studentId, registrations, transactions, workshops) {
  const byId = new Map(transactions.map(transaction => [transaction.id, transaction]));
  const byRegistration = new Map(transactions.filter(transaction => transaction.registrationId)
    .map(transaction => [transaction.registrationId, transaction]));
  const titles = new Map(workshops.map(workshop => [workshop.id, workshop.title]));

  return registrations.map(registration => {
    const legacyId = registration.workshopId
      ? completionTransactionId(studentId, registration.workshopId, registration.sessionId || null)
      : null;
    const legacy = byId.get(legacyId);
    const transaction = byRegistration.get(registration.id) || (!legacy?.registrationId ? legacy : null);
    const xp = transaction?.points ?? transaction?.amount ?? transaction?.xpAmount;
    return {
      id: registration.id,
      title: registration.workshopSnapshot?.title || titles.get(registration.workshopId) || "Workshop unavailable",
      date: registration.completedAt || registration.attendedAt || registration.sessionSnapshot?.startDate || registration.createdAt || null,
      status: registration.status || null,
      attendanceStatus: registration.attendanceStatus || null,
      completionSource: registration.completionSource || null,
      xpStatus: transaction?.status || null,
      xpAwarded: registration.status === "completed" && transaction?.status === "completed" &&
        Number.isSafeInteger(xp) && xp > 0 ? xp : null,
    };
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
