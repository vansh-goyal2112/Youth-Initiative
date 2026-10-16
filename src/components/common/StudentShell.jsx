"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import StudentHeader, { StudentBottomNavigation } from "@/components/common/StudentHeader";
import styles from "./studentShell.module.css";
import { isStudentRoute, studentBackDestination } from "@/utils/studentRouteConfig.mjs";

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

  const back = studentBackDestination(pathname);

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
