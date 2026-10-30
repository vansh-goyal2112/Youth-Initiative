import { resolveWorkshopImage } from "./workshopImageAssignment.mjs";

// Using the full workshop record keeps the same photo across all student views.
export function getWorkshopImage(workshop = {}) {
  if (typeof workshop === "object" && workshop !== null) {
    const resolved = resolveWorkshopImage(workshop);
    if (resolved) return resolved;
  }

  // Only a neutral fallback for records without a curated picture.
  return "/images/landing/youth-campus.png";
}
