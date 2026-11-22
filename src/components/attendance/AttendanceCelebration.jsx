"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Award, CheckCircle2, PartyPopper, Sparkles, Trophy, X } from "lucide-react";
import styles from "./attendanceCelebration.module.css";
import { attendanceCelebrationDetails } from "@/utils/attendanceCelebration.mjs";

export default function AttendanceCelebration({ result, onClose }) {
  const titleRef = useRef(null);
  const reward = result?.reward;
  const { xpEarned: earnedXp, confirmedReward, newBadges: badges } = attendanceCelebrationDetails(result);
  const title = result?.workshop?.title || "your experience";

  useEffect(() => {
    titleRef.current?.focus();
    if (!confirmedReward || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let active = true;
    const timers = [];
    let cancelFireworks = () => {};
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (!active) return;
      const colors = ["#ffce50", "#fa4d75", "#8d68ef", "#5dccfb", "#72e3a2"];
      const bursts = [
        { delay: 0, x: 0.2, y: 0.35 },
        { delay: 240, x: 0.8, y: 0.3 },
        { delay: 510, x: 0.48, y: 0.25 },
      ];
      bursts.forEach(({ delay, x, y }) => {
        timers.push(window.setTimeout(() => {
          if (active) {
            confetti({ particleCount: 75, spread: 75, startVelocity: 39,
              origin: { x, y }, colors, scalar: 1.05, disableForReducedMotion: true,
              zIndex: 1100 });
          }
        }, delay));
      });
      cancelFireworks = () => { confetti.reset(); };
    }).catch(() => { /* A reward should still display if animation is unavailable. */ });

    return () => {
      active = false;
      timers.forEach(timer => window.clearTimeout(timer));
      cancelFireworks();
    };
  }, [confirmedReward]);

  return (
    <div className={styles.backdrop}>
      <section className={styles.dialog} role="dialog" aria-modal="true"
        aria-labelledby="attendance-celebration-title"
        aria-describedby="attendance-celebration-description">
        <button className={styles.close} type="button" onClick={onClose} aria-label="Close attendance celebration">
          <X size={22} aria-hidden="true" />
        </button>
        <div className={styles.illustration} aria-hidden="true">
          {confirmedReward ? <PartyPopper size={50} /> : <CheckCircle2 size={50} />}
        </div>
        <span className={styles.eyebrow}>ATTENDANCE VERIFIED</span>
        <h2 id="attendance-celebration-title" tabIndex={-1} ref={titleRef}>
          {confirmedReward ? "Congratulations!" : "Attendance recorded!"}
        </h2>
        <p id="attendance-celebration-description" className={styles.description}>
          You checked in to <strong>{title}</strong>.
        </p>

        {confirmedReward ? (
          <>
            <div className={styles.xp}>
              <Sparkles size={27} aria-hidden="true" />
              <div><span>YOU EARNED</span><strong>+{earnedXp} XP</strong></div>
            </div>
            {badges.length > 0 ? (
              <div className={styles.badges}>
                <div className={styles.badgeHeading}><Trophy size={20} aria-hidden="true" />
                  {badges.length === 1 ? "New badge unlocked!" : "New badges unlocked!"}
                </div>
                {badges.map(badge => (
                  <div className={styles.badge} key={badge.id}>
                    <Award size={26} aria-hidden="true" />
                    <strong>{badge.name}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.encouragement}>Every experience moves your learning journey forward!</p>
            )}
            <div className={styles.stats}>
              <span>Total XP <strong>{reward.totalXp}</strong></span>
              <span>Level <strong>{reward.level}</strong></span>
            </div>
          </>
        ) : (
          <div className={styles.pending} role="status">
            Your attendance is confirmed. Your XP and badges are still being processed;
            check My Journey for the updated rewards.
          </div>
        )}

        <div className={styles.actions}>
          <Link href="/completed-workshops" className={styles.primary}>My Completed Experiences</Link>
          <Link href="/journey" className={styles.secondary}>View My Journey</Link>
        </div>
        <button className={styles.done} type="button" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}
