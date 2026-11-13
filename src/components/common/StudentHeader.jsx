"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, Compass, Home, LogOut, Sparkles, Trophy, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import styles from "./studentNavigation.module.css";

const navigation = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/workshops", label: "Workshops", Icon: BookOpen },
  { href: "/journey", label: "Journey", Icon: Compass },
  { href: "/badges", label: "Badges", Icon: Trophy },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

function activeRoute(pathname) {
  if (pathname === "/dashboard") return "/dashboard";
  if (pathname === "/journey" || pathname === "/reward") return "/journey";
  if (pathname === "/badges") return "/badges";
  if (pathname === "/profile" || pathname === "/edit-profile") return "/profile";
  return "/workshops";
}

export default function StudentHeader({ backHref, backLabel = "Back", studentName }) {
  const pathname = usePathname();
  const current = activeRoute(pathname);
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      try {
        await fetch("/api/admin/mfa/logout", { method: "POST" });
      } catch {
        // An unavailable admin endpoint must not block student sign-out.
      }
      await signOut(auth);
      sessionStorage.removeItem("adminSession");
      sessionStorage.removeItem("pendingRegistration");
      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutError("Could not log out. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <header className={styles.shell}>
      <div className={styles.headerInner}>
        <Link href="/dashboard" className={styles.brand} aria-label="SAIT Youth Initiative Skill Quest — Home">
          <Image
            src="/images/landing/sait-logo.jpg"
            alt="SAIT"
            width={112}
            height={42}
            priority={pathname === "/dashboard"}
            className={styles.logo}
          />
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.brandWords}>
            <strong>Youth Initiative</strong>
            <small>SKILL QUEST <Sparkles size={12} aria-hidden="true"/></small>
          </span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Student main navigation">
          {navigation.map(({href,label}) => (
            <Link
              key={href}
              href={href}
              className={current === href ? styles.current : ""}
              aria-current={current === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className={styles.headerEnd}>
          <Link href="/journey" className={styles.questChip}>
            <Sparkles size={15} aria-hidden="true" />
            <span>My Adventure</span>
          </Link>
          {studentName && (
            <Link href="/profile" className={styles.userChip} aria-label={`${studentName}, open profile`}>
              {String(studentName).trim().charAt(0).toUpperCase()}
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={styles.logoutButton}
            aria-label={loggingOut ? "Logging out" : "Log out"}
            title="Log out"
          >
            <LogOut size={17} aria-hidden="true" />
            <span>{loggingOut ? "Logging out" : "Log out"}</span>
          </button>
          {logoutError && <span role="alert" className={styles.logoutError}>{logoutError}</span>}
        </div>
      </div>

      {backHref && (
        <div className={styles.breadcrumbRow}>
          <Link href={backHref} className={styles.backLink}>
            <ArrowLeft size={17} aria-hidden="true"/>
            {backLabel}
          </Link>
        </div>
      )}
    </header>
  );
}

export function StudentBottomNavigation() {
  const pathname = usePathname();
  const current = activeRoute(pathname);
  return (
    <nav className={styles.mobileNav} aria-label="Student mobile navigation">
      {navigation.map(({href,label,Icon}) => (
        <Link key={href} href={href} className={current === href ? styles.mobileCurrent : ""} aria-current={current === href ? "page" : undefined}>
          <Icon size={21} aria-hidden="true"/>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
