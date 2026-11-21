/**
 * The source of a completion is independent of its review state.
 * Prefer the explicit source recorded by the attendance flows;
 * legacy claims may only retain their attendance status.
 */
export function isSelfReportedCompletion(registration) {
  if (!registration || typeof registration !== "object") return false;
  if (registration.completionSource != null) {
    return registration.completionSource === "self_reported";
  }
  return registration.attendanceStatus === "self_reported";
}
