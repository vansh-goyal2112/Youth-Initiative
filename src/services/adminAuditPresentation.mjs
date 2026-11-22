const ACTION_LABELS = {
  "badge.create": "Created badge",
  "session.add": "Add workshop session",
  "session.edit": "Edit workshop session",
  "session.archive": "Archive workshop session",
  "session.duplicate": "Duplicate workshop session",
  "artwork.workshop": "Upload workshop image",
  "artwork.badge": "Upload badge artwork",
  "artwork.banner": "Upload homepage banner",
  "artwork.reward": "Upload reward artwork",
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

const SUCCESS_LABELS = {
  "workshops.create": "Created workshop",
  "workshops.edit": "Updated workshop",
  "workshops.delete": "Retired workshop",
  "workshops.import": "Imported workshops",
  "/api/admin/workshops/auto-xp": "Assigned workshop XP",
  "/api/admin/workshops/assign-images": "Assigned workshop artwork",
  "/api/admin/students/invite": "Invited student",
  "session.add": "Added workshop session",
  "session.edit": "Updated workshop session",
  "session.archive": "Archived workshop session",
  "session.duplicate": "Duplicated workshop session",
  "artwork.workshop": "Uploaded workshop image",
  "artwork.badge": "Uploaded badge artwork",
  "artwork.banner": "Uploaded homepage banner",
  "artwork.reward": "Uploaded reward artwork",
  "students.edit": "Updated student account",
  "students.deactivate": "Deactivated student account",
  "admins.manage": "Updated staff access",
  "completion.reverse": "Reversed workshop completion",
  "xp.adjust": "Corrected XP",
  "xp.redeem": "Redeemed XP",
  "attendance.manage": "Created an attendance code",
  "admins.promote_super_admin": "Granted Super Admin access",
};

const PENDING_ACTION_LABELS = {
  "badge.create": "Create badge",
  "badge.update": "Update badge",
  "badge.archive": "Archive badge",
  "badge.reactivate": "Reactivate badge",
  "badge.revoke": "Remove a student badge",
  "xp.grant": "Grant XP",
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
      ["failed", "failure"].includes(event.outcome) ? "failed" :
      ["review", "unchanged"].includes(event.outcome) ? event.outcome : "attempted";
    const recordedResult = outcome === "success" && (SUCCESS_LABELS[event.resource] || SUCCESS_LABELS[event.action]);
    const label = recordedResult || (outcome !== "success" && PENDING_ACTION_LABELS[event.action]) ||
      ROUTE_LABELS[event.resource] || action;
    const actionLabel = event.subject ? label + ": " + event.subject : label;

    return { id: event.id, staffName, actionLabel, outcome, details: event.details || [], createdAt: event.createdAt };
  });
}
