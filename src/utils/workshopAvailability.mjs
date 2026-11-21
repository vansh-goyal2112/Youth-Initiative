/**
 * Registration-closed is separate from the admin active/inactive status.
 * Unknown availability remains in the normal catalogue: do not guess closed.
 * Preserve all workshop records and their configured XP rewards.
 */
export function isRegistrationClosed(workshop) {
  return workshop?.availabilityStatus === "closed";
}

export function groupWorkshopsByAvailability(workshops = []) {
  const currentWorkshops = [];
  const closedWorkshops = [];
  for (const workshop of workshops) {
    (isRegistrationClosed(workshop) ? closedWorkshops : currentWorkshops).push(workshop);
  }
  return { currentWorkshops, closedWorkshops };
}
