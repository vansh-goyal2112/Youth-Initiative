"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import StudentAnnouncements from "@/components/common/StudentAnnouncements";
import StudentHeader, { StudentBottomNavigation } from "@/components/common/StudentHeader";
import WelcomeTutorial from "@/components/common/WelcomeTutorial";
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
  const { student, user } = useAuth();
  const previousRoute = useRef(pathname);
  const historyNavigation = useRef(false);
  const [originPath, setOriginPath] = useState(null);

  useEffect(() => {
    const previous = previousRoute.current;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem("studentBackOrigin") || "null"); } catch {}
    const hasRecordedOrigin = saved?.path === pathname && Object.prototype.hasOwnProperty.call(saved, "from");
    if (previous !== pathname) {
      // Link clicks record their origin before navigation. In particular, a
      // shared Back link must not create a forward/back navigation loop.
      const from = historyNavigation.current ? null
        : hasRecordedOrigin ? saved.from
        : isStudentRoute(previous) ? previous : null;
      historyNavigation.current = false;
      const safeFrom = isStudentRoute(from) && from !== pathname ? from : null;
      setOriginPath(safeFrom);
      previousRoute.current = pathname;
      try { sessionStorage.setItem("studentBackOrigin", JSON.stringify({ path: pathname, from: safeFrom })); } catch {}
    } else if (hasRecordedOrigin) {
      // Preserve the origin after refresh, including an explicitly cleared origin.
      setOriginPath(isStudentRoute(saved.from) && saved.from !== pathname ? saved.from : null);
    }
  }, [pathname]);

  useEffect(() => {
    function onHistoryNavigation() { historyNavigation.current = true; }
    window.addEventListener("popstate", onHistoryNavigation);
    return () => window.removeEventListener("popstate", onHistoryNavigation);
  }, []);

  useEffect(() => {
    // Capture navigation before Next.js handles it. This also works if the
    // shared shell remounts, or if the student refreshes on the destination.
    function rememberInternalLink(event) {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || event.defaultPrevented) return;
      try {
        const destination = new URL(anchor.href, window.location.href);
        if (destination.origin !== window.location.origin ||
            destination.pathname === pathname || !isStudentRoute(destination.pathname) ||
            !isStudentRoute(pathname)) return;
        const from = anchor.dataset.studentBackLink === "true" ? null : pathname;
        sessionStorage.setItem("studentBackOrigin", JSON.stringify({ path: destination.pathname, from }));
      } catch {}
    }
    document.addEventListener("click", rememberInternalLink, true);
    return () => document.removeEventListener("click", rememberInternalLink, true);
  }, [pathname]);

  if (!isStudentRoute(pathname)) {
    return children;
  }

  const back = studentBackDestination(pathname, originPath);

  return (
    <div className={styles.shell}>
      <StudentHeader
        student={student}
        originPath={originPath}
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

      <div className={styles.pageContent}>
        {user && <StudentAnnouncements userId={user.uid} />}
        {user && student && !student.schoolGrade && (
          <div className={styles.gradeNotice} role="status">
            <span><strong>One small step before exploring:</strong> Add your current school grade so we can match experiences to you.</span>
            <Link href="/edit-profile">Add my grade</Link>
          </div>
        )}
        {children}
      </div>
      {user && student && <WelcomeTutorial user={user} student={student} />}
      <StudentBottomNavigation originPath={originPath} />
    </div>
  );
}
