/** Only authenticated student routes receive the shared navigation. */
export const studentPrimaryRoutes = Object.freeze([
  "/dashboard", "/workshops", "/journey", "/badges", "/profile",
  "/edit-profile", "/registered-workshops",
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
  if (["/profile", "/edit-profile", "/registered-workshops", "/completed-workshops"].includes(pathname)) return "/profile";
  if (pathname === "/scan-attendance") {
    return originPath === "/dashboard" ? "/dashboard" :
      ["/profile", "/registered-workshops", "/completed-workshops", "/edit-profile"].includes(originPath) ? "/profile" : "/workshops";
  }
  return "/workshops";
}

const routeNames = {
  "/dashboard": "Home",
  "/workshops": "Experiences",
  "/journey": "Journey",
  "/badges": "Badges",
  "/profile": "Profile",
  "/registered-workshops": "My Experiences",
  "/completed-workshops": "Completed Experiences",
  "/scan-attendance": "Scan Attendance",
};
function routeTitle(pathname) {
  return routeNames[pathname] || (
    pathname?.startsWith("/workshops/") ? "Experience Details" :
    pathname?.startsWith("/registration-success/") ? "Registration" : "Previous Page"
  );
}

export function studentBackDestination(pathname, originPath = null) {
  if (!isStudentRoute(pathname) || pathname === "/dashboard") return null;
  if (isStudentRoute(originPath) && originPath !== pathname) {
    return { href: originPath, label: `Back to ${routeTitle(originPath)}` };
  }
  if (pathname.startsWith("/workshops/")) return { href: "/workshops", label: "Back to Experiences" };
  if (["/workshops", "/journey", "/badges", "/profile"].includes(pathname)) return { href: "/dashboard", label: "Back to Home" };
  if (pathname === "/edit-profile") return { href: "/profile", label: "Back to Profile" };
  if (pathname === "/registered-workshops" || pathname === "/completed-workshops") return { href: "/profile", label: "Back to Profile" };
  if (pathname === "/scan-attendance") return { href: "/registered-workshops", label: "Back to My Experiences" };
  if (pathname.startsWith("/registration-success/")) return { href: "/workshops", label: "Back to Experiences" };
  return { href: "/dashboard", label: "Back to Home" };
}
