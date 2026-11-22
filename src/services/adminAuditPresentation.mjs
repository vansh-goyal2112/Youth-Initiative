const ACTION_LABELS = {
  "badge.create": "Created badge",
  "badge.update": "Updated badge",
  "badge.archive": "Archived badge",
  "badge.reactivate": "Reactivated badge",
  "badge.revoke": "Removed a student badge",
  "badges.manage": "Manage badges",
  "completion.approve": "Approved workshop completion",
  "completion.reverse": "Reverse workshop completion",
  "completion.review": "Review workshop completion",
  "xp.grant": "Granted XP",
  "xp.adjust": "Adjust XP",
  "xp.redeem": "Redeem XP",
  "students.view": "View student information",
  "students.edit": "Edit student information",
  "students.deactivate": "Deactivate student account",
  "students.delete": "Delete student account",
  "reports.generate": "Generate report",
  "reports.export": "Export report",
  "reports.search": "Search for a student report",
  "workshops.view": "View workshops",
  "workshops.create": "Create workshop",
  "workshops.edit": "Edit workshop",
  "workshops.delete": "Retire workshop",
  "workshops.import": "Import workshops",
  "attendance.view": "View attendance",
  "attendance.manage": "Manage attendance",
  "admins.view": "View staff access",
  "admins.approve": "Approve staff access",
  "admins.manage": "Update staff access",
  "admins.promote_super_admin": "Grant Super Admin access",
  "audit.view": "View audit activity",
};

const ROUTE_LABELS = {
  "/api/admin/media/upload": "Upload artwork",
  "/api/admin/workshops/assign-images": "Assign workshop artwork",
  "/api/admin/students/invite": "Invite student",
};

const PENDING_BADGE_LABELS = {
  "badge.create": "Create badge",
  "badge.update": "Update badge",
  "badge.archive": "Archive badge",
  "badge.reactivate": "Reactivate badge",
};

export function presentAdminAudit(events, staff, limit) {
  const completedAttempts = new Set(events.map(event => event.attemptId).filter(Boolean));
  const staffById = new Map(staff.map(person => [person.id, person]));
  return events.filter(event => !completedAttempts.has(event.id)).slice(0, limit).map(event => {
    const person = staffById.get(event.actorUid);
    const staffName = [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim() ||
      person?.displayName || person?.email || "Unknown staff member";
    const action = event.action === "badges.manage" && event.resource === "/api/admin/badges/revoke"
      ? "Remove a student badge"
      : ACTION_LABELS[event.action] || "Administrative action";
    const outcome = ["success", "completed"].includes(event.outcome) ? "success" :
      ["failed", "failure"].includes(event.outcome) ? "failed" : "attempted";
    const recordedResult = outcome === "success" && {
      "completion.reverse": "Reversed workshop completion",
      "xp.adjust": "Corrected XP",
      "admins.promote_super_admin": "Granted Super Admin access",
    }[event.action];
    const label = recordedResult || (outcome !== "success" && PENDING_BADGE_LABELS[event.action]) ||
      ROUTE_LABELS[event.resource] || action;
    const actionLabel = event.subject ? label + ": " + event.subject : label;

    return { id: event.id, staffName, actionLabel, outcome, createdAt: event.createdAt };
  });
}
