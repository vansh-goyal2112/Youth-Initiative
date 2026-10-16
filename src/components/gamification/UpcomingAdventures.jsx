"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Rocket, Sparkles } from "lucide-react";
import { useMemo } from "react";

import {
  findUpcomingAdventures,
  workshopDateLabel,
} from "@/utils/upcomingWorkshops.mjs";
import styles from "./upcomingAdventures.module.css";

function displayDate(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value || "");
  if (!match) return "Date to be announced";
  const parsed = new Date(`${match[1]}T12:00:00`);
  return parsed.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function UpcomingAdventures({ workshops = [], registrations = [] }) {
  const upcoming = useMemo(
    () => findUpcomingAdventures(workshops, registrations),
    [workshops, registrations]
  );

  if (upcoming.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="coming-adventures-heading">
      <div className={styles.header}>
        <div className={styles.headingCopy}>
          <span><Sparkles size={17} aria-hidden="true" /> YOUR NEXT DISCOVERY</span>
          <h2 id="coming-adventures-heading">Adventures Coming Soon!</h2>
          <p>See what's happening at SAIT this week. Find something that sparks your curiosity!</p>
        </div>
        <span className={styles.rocket} aria-hidden="true"><Rocket size={35} /></span>
      </div>

      <div className={styles.grid}>
        {upcoming.map((workshop) => (
          <article className={styles.card} key={workshop.id}>
            <div className={styles.cardTop}>
              <span className={styles.dayBadge}>
                <CalendarDays size={16} aria-hidden="true" />
                {workshopDateLabel(workshop.daysAway)}
              </span>
              <span className={styles.category}>{workshop.category || "SAIT Youth"}</span>
            </div>
            <h3>{workshop.title}</h3>
            <p className={styles.date}>{displayDate(workshop.startDate)} · {workshop.learningMode || "Workshop"}</p>
            <Link href={`/workshops/${encodeURIComponent(workshop.id)}`} className={styles.cta}>
              View &amp; register <ArrowRight size={17} aria-hidden="true"/>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
