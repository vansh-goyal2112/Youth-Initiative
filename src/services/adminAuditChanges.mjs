// Only explicitly selected fields appear in audit details. Free-form notes,
// links, passwords and student profile values are never copied into the log.
export function auditFieldChanges(before, after, fields) {
  return fields.flatMap(([key, label, showValues = false]) => {
    const previous = before?.[key] ?? null;
    const next = after?.[key] ?? null;
    if (JSON.stringify(previous) === JSON.stringify(next)) return [];
    if (!showValues) return [label + " changed"];
    const display = value => value == null || value === "" ? "not set" : String(value);
    return [label + " changed from " + display(previous) + " to " + display(next)];
  });
}

export const WORKSHOP_AUDIT_FIELDS = [
  ["xpReward", "XP reward", true], ["status", "Availability status", true],
  ["title", "Title", true], ["programArea", "Program area", true], ["category", "Category", true],
  ["grade", "Grade range", true], ["capacity", "Capacity", true],
  ["startDate", "Start date", true], ["endDate", "End date", true], ["time", "Time", true],
  ["learningMode", "Delivery format", true], ["location", "Location", true],
  ["description", "Description"], ["interestTags", "Interest tags"],
  ["informationUrl", "Information link"], ["registrationUrl", "Registration link"],
];
