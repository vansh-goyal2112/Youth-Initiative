import { schoolGradeNumber } from "./workshopGrades.mjs";

/**
 * Never treat an unrestored session (or a failed request) as an empty catalogue.
 * This shared decision is kept pure so direct-load and refresh states are testable.
 */
export function getWorkshopCatalogueViewState({
  authLoading = true,
  authenticated = false,
  loading = true,
  loadedForKey = null,
  sessionKey = null,
  gradeRequired = false,
  schoolGrade = null,
  errorMessage = "",
} = {}) {
  if (authLoading) return "loading";
  if (!authenticated) return "login";
  if (loading || !sessionKey || loadedForKey !== sessionKey) return "loading";
  if (errorMessage) return "error";
  if (gradeRequired || schoolGradeNumber(schoolGrade) === null) return "grade";
  return "ready";
}
