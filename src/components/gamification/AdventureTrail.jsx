"use client";

import Link from "next/link";
import {
  Check,
  Compass,
  Cpu,
  Hammer,
  Rocket,
  Sparkles,
  Star,
  Trophy,
  ArrowRight,
} from "lucide-react";

import styles from "./adventureTrail.module.css";

const questIcons = {
  rocket: Rocket,
  hammer: Hammer,
  compass: Compass,
  cpu: Cpu,
  trophy: Trophy,
};

export default function AdventureTrail({ quests = [], nextStop, catalogueStatus, showBadgeLink = true }) {
  const firstIncomplete = quests.findIndex((quest) => !quest.completed);
  const activeIndex = firstIncomplete;
  const completedCount = quests.filter((quest) => quest.completed).length;

  return (
    <section className={styles.adventure} aria-labelledby="skill-quest-heading">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>
            <Sparkles size={17} aria-hidden="true" />
            SAIT LEARNING JOURNEY
          </span>
          <h2 id="skill-quest-heading">Your Adventure Map</h2>
          <p>
            Every verified experience moves your learning story forward.
            Explore at your own pace—no experience is locked behind a level.
          </p>
        </div>
        <div className={styles.countBadge} aria-label={`${completedCount} of ${quests.length} milestones completed`}>
          <Star size={21} aria-hidden="true" />
          <strong>{completedCount}/{quests.length}</strong>
          <span>Milestones</span>
        </div>
      </div>

      <div className={styles.trailWrapper}>
        <div className={styles.decorA} aria-hidden="true">✦</div>
        <div className={styles.decorB} aria-hidden="true">✳</div>
        <ol className={styles.trail}>
          {quests.map((quest, index) => {
            const Icon = questIcons[quest.icon] || Compass;
            const current = Math.min(
              Math.max(0, Number(quest.current) || 0),
              Math.max(1, Number(quest.target) || 1)
            );
            const target = Math.max(1, Number(quest.target) || 1);
            const percent = Math.round((current / target) * 100);
            const status = quest.completed
              ? "completed"
              : index === activeIndex
                ? "current"
                : "upcoming";

            return (
              <li
                className={`${styles.stop} ${styles[status]}`}
                key={quest.id}
                aria-current={status === "current" ? "step" : undefined}
              >
                <div className={styles.marker}>
                  <span className={styles.markerArt} aria-hidden="true">
                    {quest.completed ? <Check size={32} /> : <Icon size={32} />}
                  </span>
                  <span className={styles.stepNo}>{String(index + 1).padStart(2, "0")}</span>
                </div>

                <div className={styles.stopContent}>
                  <div className={styles.stopTop}>
                    <span className={styles.stage}>ADVENTURE {index + 1}</span>
                    <span className={styles.status}>
                      {status === "completed" ? "✓ Completed" : status === "current" ? "★ Up next" : "On your map"}
                    </span>
                  </div>
                  <h3>{quest.title}</h3>
                  <p>{quest.description}</p>
                  <div
                    className={styles.progress}
                    role="progressbar"
                    aria-label={`${quest.title} progress`}
                    aria-valuemin={0}
                    aria-valuemax={target}
                    aria-valuenow={current}
                  >
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <div className={styles.stopFooter}>
                    <span>{current} of {target} completed</span>
                    {status === "current" ? (
                      <Link href="/workshops" className={styles.action}>
                        Explore experiences <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    ) : (
                      <span>{quest.completed ? "Milestone reached!" : "Keep exploring"}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerIcon}><Trophy size={29} aria-hidden="true" /></div>
        <div>
          {nextStop ? (
            <>
              <span className={styles.eyebrow}>UP NEXT</span>
              <strong>{nextStop.title}</strong>
              <p>{nextStop.description}{nextStop.target && ` ${nextStop.current} of ${nextStop.target} completed.`}</p>
              <Link href={nextStop.href}>View experience <ArrowRight size={16} aria-hidden="true" /></Link>
            </>
          ) : activeIndex >= 0 ? (
            <p>Follow your next stop to keep building your Learning Journey.</p>
          ) : (
            <>
              <strong>{catalogueStatus === "ready" ? "You’re all caught up" : "Your Learning Journey continues"}</strong>
              <p>{catalogueStatus === "ready"
                ? "Your next stop will appear when a new experience or badge matches your interests."
                : catalogueStatus === "loading" ? "Looking for your next stop…" : "Your next stop is temporarily unavailable."}</p>
            </>
          )}
        </div>
        {showBadgeLink && <Link href="/badges">See my badges <ArrowRight size={16} aria-hidden="true" /></Link>}
      </div>
    </section>
  );
}
