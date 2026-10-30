import { resolveWorkshopImage } from "./workshopImageAssignment.mjs";

// Returns a real assigned image or null. Missing images are represented by
// a branded, accessible placeholder instead of an unrelated campus photo.
export function getWorkshopImage(workshop = {}) {
  if (!workshop || typeof workshop !== "object") return null;
  if (workshop.imageStatus === "needs_image") return null;
  return resolveWorkshopImage(workshop);
}
