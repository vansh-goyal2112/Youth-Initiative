/**
 * Only signed-in student experience routes receive Skill Quest chrome.
 * Public onboarding, login and administrator pages keep their own layouts.
 */
export const studentPrimaryRoutes = Object.freeze([
  "/dashboard",
  "/workshops",
  "/journey",
  "/badges",
  "/profile",
  "/tasks",
  "/edit-profile",
  "/registered-workshops",
  "/completed-workshops",
  "/scan-attendance",
  "/reward",
]);

export function isStudentRoute(pathname) {
  if (typeof pathname !== "string") return false;
  return (
    studentPrimaryRoutes.includes(pathname) ||
    pathname.startsWith("/workshops/") ||
    pathname.startsWith("/registration-success/")
  );
}

export function studentBackDestination(pathname) {
  if (!isStudentRoute(pathname) || pathname === "/dashboard") return null;
  if (pathname.startsWith("/workshops/")) return { href: "/workshops", label: "Back to Workshops" };
  if (pathname === "/workshops") return { href: "/dashboard", label: "Back to Home" };
  if (pathname === "/journey" || pathname === "/badges" || pathname === "/profile") {
    return { href: "/dashboard", label: "Back to Home" };
  }
  if (pathname === "/tasks") return { href: "/profile", label: "Back to Profile" };
  if (pathname === "/edit-profile") return { href: "/profile", label: "Back to Profile" };
  if (pathname === "/registered-workshops") return { href: "/workshops", label: "Back to Workshops" };
  if (pathname === "/completed-workshops" || pathname === "/scan-attendance") {
    return { href: "/registered-workshops", label: "Back to My Workshops" };
  }
  if (pathname.startsWith("/registration-success/")) {
    return { href: "/workshops", label: "Back to Workshops" };
  }
  return { href: "/dashboard", label: "Back to Home" };
}
