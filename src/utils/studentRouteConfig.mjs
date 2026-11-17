/** Only authenticated student routes receive the shared navigation. */
export const studentPrimaryRoutes = Object.freeze([
  "/dashboard", "/workshops", "/journey", "/badges", "/profile",
  "/tasks", "/edit-profile", "/registered-workshops",
  "/completed-workshops", "/scan-attendance", "/reward",
]);

export function isStudentRoute(pathname) {
  return typeof pathname === "string" && (
    studentPrimaryRoutes.includes(pathname) ||
    pathname.startsWith("/workshops/") ||
    pathname.startsWith("/registration-success/")
  );
}

export function studentActiveTab(pathname, originPath = null) {
  if (pathname === "/dashboard") return "/dashboard";
  if (pathname === "/journey" || pathname === "/reward") return "/journey";
  if (pathname === "/badges") return "/badges";
  if (["/profile", "/edit-profile", "/tasks", "/registered-workshops", "/completed-workshops"].includes(pathname)) return "/profile";
  if (pathname === "/scan-attendance") {
    return originPath === "/dashboard" ? "/dashboard" :
      ["/profile", "/registered-workshops", "/completed-workshops", "/edit-profile"].includes(originPath) ? "/profile" : "/workshops";
  }
  return "/workshops";
}

const routeNames = {
  "/dashboard": "Home",
  "/workshops": "Workshops",
  "/journey": "Journey",
  "/badges": "Badges",
  "/profile": "Profile",
  "/registered-workshops": "My Workshops",
  "/completed-workshops": "Completed Workshops",
  "/scan-attendance": "Scan Attendance",
};
function routeTitle(pathname) {
  return routeNames[pathname] || (
    pathname?.startsWith("/workshops/") ? "Workshop Details" :
    pathname?.startsWith("/registration-success/") ? "Registration" : "Previous Page"
  );
}

export function studentBackDestination(pathname, originPath = null) {
  if (!isStudentRoute(pathname) || pathname === "/dashboard") return null;
  if (isStudentRoute(originPath) && originPath !== pathname) {
    return { href: originPath, label: `Back to ${routeTitle(originPath)}` };
  }
  if (pathname.startsWith("/workshops/")) return { href: "/workshops", label: "Back to Workshops" };
  if (["/workshops", "/journey", "/badges", "/profile"].includes(pathname)) return { href: "/dashboard", label: "Back to Home" };
  if (pathname === "/tasks" || pathname === "/edit-profile") return { href: "/profile", label: "Back to Profile" };
  if (pathname === "/registered-workshops" || pathname === "/completed-workshops") return { href: "/profile", label: "Back to Profile" };
  if (pathname === "/scan-attendance") return { href: "/registered-workshops", label: "Back to My Workshops" };
  if (pathname.startsWith("/registration-success/")) return { href: "/workshops", label: "Back to Workshops" };
  return { href: "/dashboard", label: "Back to Home" };
}
