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
  Gift,
  LockKeyhole,
  Map,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

import { studentFetch } from "@/services/studentApi";
import {
  getReflectionStats,
  LEARNING_MOMENTS,
  REFLECTION_MOODS,
} from "@/services/skillQuestEngagement.mjs";
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
  registrations = [],
  student,
  onRegistrationsRefresh,
}) {
  const quests = Array.isArray(gameData?.quests) ? gameData.quests : [];
  const stats = useMemo(() => getReflectionStats(registrations), [registrations]);

  const [selectedQuestId, setSelectedQuestId] = useState(null);
  const [focusSaving, setFocusSaving] = useState(false);
  const [focusError, setFocusError] = useState("");
  const [focusSuccess, setFocusSuccess] = useState("");

  const [reflectionId, setReflectionId] = useState(null);
  const [mood, setMood] = useState("");
  const [moment, setMoment] = useState("");
  const [reflectionSaving, setReflectionSaving] = useState(false);
  const [reflectionError, setReflectionError] = useState("");
  const [reflectionSuccess, setReflectionSuccess] = useState("");

  const focusId = selectedQuestId || gameData?.activeQuestId || null;
  const unfinished = quests.filter((quest) => !quest.completed);
  const focusQuest = quests.find((quest) => quest.id === focusId) || unfinished[0] || quests[0];
  const nextReflection = stats.pending[0];
  const reflectionWorkshop = stats.pending.find((item) => item.id === reflectionId) || nextReflection;
  const reflectionOpen = Boolean(reflectionId) && Boolean(reflectionWorkshop);
  const completedMissions = quests.filter((quest) => quest.completed).length;
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
      if (!response.ok) throw new Error(data.message || "Could not save mission.");
      setSelectedQuestId(id);
      setFocusSuccess("Mission saved! You can follow it at your own pace.");
    } catch (error) {
      setFocusError(error.message || "Could not save your mission.");
    } finally {
      setFocusSaving(false);
    }
  }

  async function saveReflection(event) {
    event.preventDefault();
    if (reflectionSaving || !reflectionWorkshop || !mood || !moment) return;

    setReflectionError("");
    setReflectionSuccess("");
    setReflectionSaving(true);

    try {
      const response = await studentFetch("/api/gamification/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: reflectionWorkshop.id,
          mood,
          moment,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save reflection.");

      setReflectionId(null);
      setMood("");
      setMoment("");
      setReflectionSuccess("Learning stamp saved! Your workshop story has grown.");
      if (typeof onRegistrationsRefresh === "function") {
        await onRegistrationsRefresh();
      }
    } catch (error) {
      setReflectionError(error.message || "Could not save your reflection.");
    } finally {
      setReflectionSaving(false);
    }
  }

  return (
    <section className={styles.hub} aria-labelledby="quest-hub-title">
      <div className={styles.intro}>
        <div className={styles.introDecor} aria-hidden="true"><Sparkles size={65}/></div>
        <div className={styles.introText}>
          <span className={styles.kicker}><WandSparkles size={18} aria-hidden="true"/> SKILL QUEST HQ</span>
          <h2 id="quest-hub-title">Ready for your next adventure, {firstName}?</h2>
          <p>Choose a mission, discover workshops, and collect real achievements as you learn. Every step tells your story!</p>
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

      <div className={styles.overview} aria-label="Your learning progress">
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
        <div className={styles.overviewStat}>
          <BookOpen size={22} aria-hidden="true"/>
          <strong>{gameData.completedWorkshops}</strong>
          <span>Workshops</span>
        </div>
        <div className={styles.overviewStat}>
          <Trophy size={22} aria-hidden="true"/>
          <strong>{gameData.badgeCount}</strong>
          <span>Badges</span>
        </div>
        <div className={styles.overviewStat}>
          <Gift size={22} aria-hidden="true"/>
          <strong>{stats.reflectedCount}</strong>
          <span>Journal Stamps</span>
        </div>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.panel} aria-labelledby="my-mission-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionSymbol}><Flag size={22} aria-hidden="true"/></span>
            <div><span className={styles.eyebrow}>MAKE IT YOUR QUEST</span><h3 id="my-mission-heading">Choose Your Mission</h3></div>
          </div>
          <p className={styles.panelLead}>Pick a challenge to focus on. You can change it anytime—your verified progress always stays saved.</p>
          {focusQuest && (
            <div className={styles.featuredMission}>
              <div className={styles.featuredTop}>
                <span><Sparkles size={16} aria-hidden="true"/> MY ACTIVE MISSION</span>
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
                  {active ? <CheckCircle2 size={21} aria-label="Selected mission"/> : <ChevronRight size={19} aria-hidden="true"/>}
                </button>
              );
            })}
          </div>
          <p className={styles.helpText}><ShieldCheck size={16} aria-hidden="true"/> Only verified workshop participation earns XP. Missions track genuine progress.</p>
          {focusError && <p role="alert" className={styles.error}>{focusError}</p>}
          {focusSuccess && <p role="status" className={styles.success}>{focusSuccess}</p>}
          <Link href="/journey" className={styles.panelLink}>See the full Adventure Map <ArrowRight size={16} aria-hidden="true"/></Link>
        </section>

        <section className={styles.panel} aria-labelledby="reflection-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionSymbol}><Sparkles size={22} aria-hidden="true"/></span>
            <div><span className={styles.eyebrow}>AFTER YOUR WORKSHOP</span><h3 id="reflection-heading">My Learning Journal</h3></div>
          </div>
          <p className={styles.panelLead}>Every workshop is more than a date. Save how you felt and what you tried—your personal story grows with you.</p>
          <div className={styles.stampProgress}>
            <span className={styles.stampIcon}><Award size={25} aria-hidden="true"/></span>
            <div>
              <strong>{stats.reflectedCount} learning {stats.reflectedCount === 1 ? "stamp" : "stamps"}</strong>
              <p>{stats.completedCount ? `${stats.reflectedCount} of ${stats.completedCount} verified workshops reflected on` : "Complete your first workshop to start your journal"}</p>
            </div>
          </div>

          {nextReflection ? (
            <div className={styles.reflectionPrompt}>
              <div className={styles.pendingIcon}><BookOpen size={26} aria-hidden="true"/></div>
              <span className={styles.eyebrow}>A NEW STORY IS WAITING</span>
              <h4>{nextReflection.workshop?.title || "Your completed workshop"}</h4>
              <p>You attended this workshop! Ready to remember what you learned?</p>
              {!reflectionOpen && (
                <button className={styles.reflectButton} type="button" onClick={() => {setReflectionId(nextReflection.id);setReflectionError("");}}>
                  Add a Journal Stamp <ArrowRight size={17} aria-hidden="true"/>
                </button>
              )}
            </div>
          ) : (
            <div className={styles.reflectionEmpty}>
              <span className={styles.bigStar} aria-hidden="true">{stats.reflectedCount > 0 ? "✦" : "★"}</span>
              <strong>{stats.reflectedCount > 0 ? "You're all caught up!" : "Your story starts here"}</strong>
              <p>{stats.reflectedCount > 0 ? "Every verified workshop has a journal stamp. Keep exploring!" : "After attending a workshop, come back to reflect and collect your first stamp."}</p>
              <Link href="/workshops">Discover Workshops <ArrowRight size={16} aria-hidden="true"/></Link>
            </div>
          )}

          {reflectionOpen && (
            <form className={styles.reflectionForm} onSubmit={saveReflection}>
              <div className={styles.formHeader}>
                <strong>Capture your learning moment</strong>
                <button type="button" className={styles.closeButton} onClick={() => {setReflectionId(null);setReflectionError("");}} aria-label="Close reflection form">×</button>
              </div>
              <fieldset>
                <legend>How did you feel after the workshop?</legend>
                <div className={styles.moodGrid}>
                  {REFLECTION_MOODS.map((option) => (
                    <label className={`${styles.moodOption} ${mood === option.id ? styles.optionSelected : ""}`} key={option.id}>
                      <input type="radio" name="reflectionMood" value={option.id} checked={mood===option.id} onChange={() => setMood(option.id)} required/>
                      <span aria-hidden="true">{option.emoji}</span>
                      <small>{option.label}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>What is one thing you did?</legend>
                <div className={styles.momentGrid}>
                  {LEARNING_MOMENTS.map((option) => (
                    <label className={`${styles.momentOption} ${moment === option.id ? styles.optionSelected : ""}`} key={option.id}>
                      <input type="radio" name="learningMoment" value={option.id} checked={moment === option.id} onChange={() => setMoment(option.id)} required/>
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className={styles.reflectButton} type="submit" disabled={reflectionSaving || !mood || !moment}>
                {reflectionSaving ? "Saving your stamp…" : "Save My Learning Stamp"} <Check size={17} aria-hidden="true"/>
              </button>
              {reflectionError && <p className={styles.error} role="alert">{reflectionError}</p>}
            </form>
          )}
          {reflectionSuccess && <p role="status" className={styles.success}>{reflectionSuccess}</p>}
          {stats.recent.length > 0 && (
            <div className={styles.journalRecent}>
              <h4>Recent Journal Stamps</h4>
              {stats.recent.map((item) => {
                const moodOption = REFLECTION_MOODS.find((opt) => opt.id === item.reflection.mood);
                return <div className={styles.journalEntry} key={item.id}>
                  <span aria-hidden="true">{moodOption?.emoji || "⭐"}</span>
                  <div><strong>{item.workshop?.title || "Workshop completed"}</strong><small>{LEARNING_MOMENTS.find((opt) => opt.id === item.reflection.moment)?.label || "Learning recorded"}</small></div>
                  <CheckCircle2 size={19} aria-label="Saved" />
                </div>;
              })}
            </div>
          )}
        </section>
      </div>

      <div className={styles.milestoneStrip} aria-label="Your Skill Quest milestones">
        <div><Rocket size={23} aria-hidden="true"/><strong>{completedMissions}</strong><span>Quests Reached</span></div>
        <span className={styles.stripDivider} aria-hidden="true">✦</span>
        <div><Compass size={23} aria-hidden="true"/><strong>{gameData.categoryCount}</strong><span>Skill Areas</span></div>
        <span className={styles.stripDivider} aria-hidden="true">✦</span>
        <div><Award size={23} aria-hidden="true"/><strong>{stats.reflectedCount}</strong><span>Journal Stamps</span></div>
        <Link href="/journey">Keep Adventuring <ArrowRight size={17} aria-hidden="true"/></Link>
      </div>
    </section>
  );
}
