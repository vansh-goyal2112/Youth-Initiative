"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Sparkles, Trophy } from "lucide-react";
import { getReflectionStats, REFLECTION_MOODS, LEARNING_MOMENTS } from "@/services/skillQuestEngagement.mjs";
import styles from "./journalStamps.module.css";

export default function JournalStamps({ registrations = [] }) {
  const stats = getReflectionStats(registrations);
  const stamps = stats.recent;

  return (
    <section className={styles.section} aria-labelledby="learning-stamps-heading">
      <div className={styles.heading}>
        <div className={styles.headingIcon}><BookOpen size={25} aria-hidden="true"/></div>
        <div>
          <span><Sparkles size={14} aria-hidden="true"/> MY LEARNING STORY</span>
          <h2 id="learning-stamps-heading">Journal Stamp Collection</h2>
          <p>Remember what you explored, created, and learned after each verified workshop.</p>
        </div>
        <div className={styles.counter} aria-label={`${stats.reflectedCount} of ${stats.completedCount} verified workshops have reflections`}>
          <Trophy size={21} aria-hidden="true"/>
          <strong>{stats.reflectedCount}/{stats.completedCount}</strong>
          <small>Saved</small>
        </div>
      </div>
      {stamps.length ? (
        <div className={styles.stamps}>
          {stamps.map((registration) => {
            const reflection = registration.reflection;
            const mood = REFLECTION_MOODS.find((option) => option.id === reflection.mood);
            const moment = LEARNING_MOMENTS.find((option) => option.id === reflection.moment);
            return (
              <article className={styles.stamp} key={registration.id}>
                <div className={styles.stampArt} aria-hidden="true">{mood?.emoji || "🌟"}</div>
                <div>
                  <span>LEARNING STAMP UNLOCKED</span>
                  <h3>{registration.workshop?.title || "Completed Workshop"}</h3>
                  <p>{moment?.label || "A new thing learned"}</p>
                  <small>{mood?.label || "Learning remembered"}</small>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <span aria-hidden="true">✦</span>
          <div>
            <strong>Your journal is ready for its first stamp!</strong>
            <p>After completing a workshop, visit your Dashboard and save a quick reflection.</p>
          </div>
        </div>
      )}
      {stats.pending.length > 0 && (
        <div className={styles.pending}>
          <span>You have {stats.pending.length} completed {stats.pending.length === 1 ? "workshop" : "workshops"} to reflect on.</span>
          <Link href="/dashboard">Add a Journal Stamp <ArrowRight size={16} aria-hidden="true"/></Link>
        </div>
      )}
    </section>
  );
}
