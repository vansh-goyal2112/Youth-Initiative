"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Flag,
  Map,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { studentFetch } from "@/services/studentApi";
import styles from "./skillQuestHub.module.css";

const questIcons = {
  "first-steps": Rocket,
  "skill-builder": Zap,
  "curious-explorer": Compass,
  "tech-journey": Sparkles,
  "workshop-champion": Trophy,
};

function safePercentage(current, total) {
  if (!(Number(total) > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(current) / Number(total)) * 100)));
}

export default function SkillQuestHub({
  gameData,
  student,
  section = "all",
}) {
  const quests = Array.isArray(gameData?.quests) ? gameData.quests : [];

  const [selectedQuestId, setSelectedQuestId] = useState(null);
  const [focusSaving, setFocusSaving] = useState(false);
  const [focusError, setFocusError] = useState("");
  const [focusSuccess, setFocusSuccess] = useState("");

  const focusId = selectedQuestId || gameData?.activeQuestId || null;
  const unfinished = quests.filter((quest) => !quest.completed);
  const focusQuest = quests.find((quest) => quest.id === focusId) || unfinished[0] || quests[0];
  const firstName = String(student?.firstName || "Explorer").trim().split(/\s+/)[0];
  const xp = Number(gameData?.totalXp) || 0;
  const xpProgress = Math.max(0, Math.min(100, Number(gameData?.progressPercentage) || 0));

  async function chooseFocus(id) {
    if (focusSaving || id === focusId) return;

    setFocusSaving(true);
    setFocusError("");
    setFocusSuccess("");
    try {
      const response = await studentFetch("/api/gamification/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId: id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save your selection.");
      setSelectedQuestId(id);
      setFocusSuccess("Saved! Keep exploring experiences to earn XP and badges.");
    } catch (error) {
      setFocusError(error.message || "Could not save your selection.");
    } finally {
      setFocusSaving(false);
    }
  }


  return (
    <div className={styles.hub}>
      {(section === "all" || section === "hq") && (
      <div className={styles.intro}>
        <div className={styles.introDecor} aria-hidden="true"><Sparkles size={65}/></div>
        <div className={styles.introText}>
          <span className={styles.kicker}><WandSparkles size={18} aria-hidden="true"/> LEARNING JOURNEY HQ</span>
          <h2 id="quest-hub-title">Ready for your next adventure, {firstName}?</h2>
          <p>Discover experiences, earn XP, reach new levels, and unlock badges as you learn.</p>
          <div className={styles.introActions}>
            <Link href="/journey" className={styles.mainAction}><Map size={18} aria-hidden="true"/> Explore My Map <ArrowRight size={16} aria-hidden="true"/></Link>
            <Link href="/badges" className={styles.secondAction}><Award size={18} aria-hidden="true"/> My Badge Album</Link>
          </div>
        </div>
        <div className={styles.levelIsland} aria-label={`Level ${gameData.level}, ${xp} earned experience points`}>
          <div className={styles.levelGem}><Star size={32} aria-hidden="true"/></div>
          <span>YOUR LEVEL</span>
          <strong>{gameData.level}</strong>
          <small>{gameData.rank}</small>
          <div className={styles.islandXp}>{xp} XP</div>
        </div>
      </div>
      )}

      {(section === "all" || section === "level") && (
      <div className={`${styles.overview} ${section === "level" ? styles.statsOnly : ""}`} aria-label="Your learning progress">
        {section === "all" && (
        <div className={styles.xpPanel}>
          <div className={styles.xpTop}>
            <span><Zap size={17} aria-hidden="true"/> LEVEL PROGRESS</span>
            <strong>{gameData.nextLevelXp ? `${gameData.nextLevelXp - xp} XP to go` : "Top level reached!"}</strong>
          </div>
          <div
            className={styles.xpTrack}
            role="progressbar"
            aria-label="Progress toward next level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={xpProgress}
          ><div style={{ width: `${xpProgress}%` }}/></div>
          <p>{gameData.rank} · {gameData.nextLevelXp ? "Keep discovering to level up!" : "Amazing progress!"}</p>
        </div>
        )}
        <div className={styles.overviewStat}>
          <BookOpen size={22} aria-hidden="true"/>
          <strong>{gameData.completedWorkshops}</strong>
          <span>Experiences</span>
        </div>
        <div className={styles.overviewStat}>
          <Trophy size={22} aria-hidden="true"/>
          <strong>{gameData.badgeCount}</strong>
          <span>Badges</span>
        </div>
        <div className={styles.overviewStat}>
          <Star size={22} aria-hidden="true"/>
          <strong>{gameData.totalXp}</strong>
          <span>Total XP</span>
        </div>
      </div>
      )}

      {(section === "all" || section === "mission") && (
      <div className={`${styles.twoColumns} ${section === "all" ? "" : styles.singleColumn}`}>
        {(section === "all" || section === "mission") && (
        <section className={styles.panel} aria-labelledby="my-mission-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionSymbol}><Flag size={22} aria-hidden="true"/></span>
            <div><span className={styles.eyebrow}>EXPLORE WHAT INTERESTS YOU</span><h3 id="my-mission-heading">Pick What to Explore</h3></div>
          </div>
          <p className={styles.panelLead}>Choose what you want to explore next. Changing your choice does not affect your XP, level, or badges.</p>
          {focusQuest && (
            <div className={styles.featuredMission}>
              <div className={styles.featuredTop}>
                <span><Sparkles size={16} aria-hidden="true"/> MY PICK</span>
                {focusQuest.completed && <span className={styles.doneTag}><Check size={14} aria-hidden="true"/> Complete</span>}
              </div>
              <strong>{focusQuest.title}</strong>
              <p>{focusQuest.description}</p>
              <div className={styles.missionTrack} role="progressbar" aria-label={`${focusQuest.title} progress`} aria-valuemin={0} aria-valuemax={focusQuest.target} aria-valuenow={Math.min(focusQuest.target,focusQuest.current)}>
                <span style={{width: `${safePercentage(focusQuest.current,focusQuest.target)}%`}}/>
              </div>
              <small>{Math.min(focusQuest.target,focusQuest.current)} of {focusQuest.target} · {safePercentage(focusQuest.current,focusQuest.target)}% done</small>
            </div>
          )}
          <div className={styles.missionChoices}>
            {quests.map((quest) => {
              const Icon = questIcons[quest.id] || Compass;
              const active = focusQuest?.id === quest.id;
              return (
                <button
                  type="button"
                  className={`${styles.missionChoice} ${active ? styles.selected : ""}`}
                  key={quest.id}
                  onClick={() => chooseFocus(quest.id)}
                  disabled={focusSaving}
                  aria-pressed={active}
                >
                  <span className={styles.choiceIcon}><Icon size={20} aria-hidden="true"/></span>
                  <span className={styles.choiceCopy}><strong>{quest.title}</strong><small>{Math.min(quest.target,quest.current)} / {quest.target} milestones</small></span>
                  {active ? <CheckCircle2 size={21} aria-label="Selected"/> : <ChevronRight size={19} aria-hidden="true"/>}
                </button>
              );
            })}
          </div>
          <p className={styles.helpText}><ShieldCheck size={16} aria-hidden="true"/> QR-verified attendance earns full XP; self-reported experiences earn half XP and may be reviewed.</p>
          {focusError && <p role="alert" className={styles.error}>{focusError}</p>}
          {focusSuccess && <p role="status" className={styles.success}>{focusSuccess}</p>}
          <Link href="/journey" className={styles.panelLink}>See the full Adventure Map <ArrowRight size={16} aria-hidden="true"/></Link>
        </section>
        )}

      </div>
      )}


    </div>
  );
}
