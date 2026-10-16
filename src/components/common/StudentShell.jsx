"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import StudentHeader, { StudentBottomNavigation } from "@/components/common/StudentHeader";
import styles from "./studentShell.module.css";

const primaryRoutes = new Set([
  "/dashboard",
  "/workshops",
  "/journey",
  "/badges",
  "/profile",
  "/edit-profile",
  "/registered-workshops",
  "/completed-workshops",
  "/scan-attendance",
  "/reward",
]);

function isStudentRoute(pathname) {
  return (
    primaryRoutes.has(pathname) ||
    pathname.startsWith("/workshops/") ||
    pathname.startsWith("/registration-success/")
  );
}

function backDestination(pathname) {
  if (pathname === "/dashboard") return null;
  if (pathname === "/workshops") return { href: "/dashboard", label: "Back to Home" };
  if (pathname.startsWith("/workshops/")) return { href: "/workshops", label: "Back to Workshops" };
  if (pathname === "/journey" || pathname === "/badges") return { href: "/dashboard", label: "Back to Home" };
  if (pathname === "/profile") return { href: "/dashboard", label: "Back to Home" };
  if (pathname === "/edit-profile") return { href: "/profile", label: "Back to Profile" };
  if (pathname === "/completed-workshops") return { href: "/registered-workshops", label: "Back to My Workshops" };
  if (pathname === "/registered-workshops") return { href: "/workshops", label: "Back to Workshops" };
  if (pathname === "/scan-attendance") return { href: "/registered-workshops", label: "Back to My Workshops" };
  if (pathname.startsWith("/registration-success/")) return { href: "/workshops", label: "Back to Workshops" };
  return { href: "/dashboard", label: "Back to Home" };
}

/**
 * A single shell provides consistent student navigation without changing
 * the existing page contents, API contracts or admin/onboarding layouts.
 * Existing page-specific chrome is visually hidden by scoped CSS until
 * it can be removed during a dedicated cleanup pass.
 */
export default function StudentShell({ children }) {
  const pathname = usePathname() || "";
  const { student } = useAuth();

  if (!isStudentRoute(pathname)) {
    return children;
  }

  const back = backDestination(pathname);

  return (
    <div className={styles.shell}>
      <StudentHeader
        studentName={student?.firstName || null}
        backHref={back?.href}
        backLabel={back?.label}
      />

      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.bubbleOne} />
        <span className={styles.bubbleTwo} />
        <span className={styles.bubbleThree} />
        <span className={styles.bubbleFour} />
        <span className={styles.starOne}>✦</span>
        <span className={styles.starTwo}>✳</span>
        <span className={styles.starThree}>✦</span>
      </div>

      <div className={styles.pageContent}>{children}</div>
      <StudentBottomNavigation />
    </div>
  );
}
