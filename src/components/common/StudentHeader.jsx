"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, Compass, Home, Sparkles, Trophy, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
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
  if (pathname === "/journey") return "/journey";
  if (pathname === "/badges") return "/badges";
  if (pathname === "/profile" || pathname === "/edit-profile") return "/profile";
  return "/workshops";
}

export default function StudentHeader({ backHref, backLabel = "Back", studentName }) {
  const pathname = usePathname();
  const current = activeRoute(pathname);

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
