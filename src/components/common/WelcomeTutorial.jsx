"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Compass, Gift, QrCode, Sparkles, Trophy, X } from "lucide-react";
import { studentFetch } from "@/services/studentApi";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./welcomeTutorial.module.css";

const CARDS = [
  {
    id: "welcome",
    eyebrow: "WELCOME, EXPLORER",
    heading: "Your learning journey starts here.",
    text: "SAIT Youth Initiatives helps you explore workshops, track what you've learned, collect achievements and discover what you could do next.",
    Icon: Sparkles,
    color: "rose",
  },
  {
    id: "discover",
    eyebrow: "STEP 1 · EXPLORE",
    heading: "Find your next workshop.",
    text: "Browse workshops by program area, choose an opportunity for your school grade, and follow its registration link to sign up for a session.",
    Icon: BookOpen,
    color: "purple",
  },
  {
    id: "checkin",
    eyebrow: "STEP 2 · CHECK IN OR CLAIM",
    heading: "Get credit for showing up.",
    text: "Scan the workshop QR code when you attend to earn full workshop XP. Attended one in the past? Choose 'Previously Completed' to claim half XP. Staff can review self-reported claims.",
    Icon: QrCode,
    color: "blue",
  },
  {
    id: "xp",
    eyebrow: "STEP 3 · EARN AND GROW",
    heading: "Earn XP. Unlock badges.",
    text: "Earn XP from workshops and unlock badges as you progress. After a verified workshop, complete the short feedback task to earn 20 more XP. Check your Total XP and Current XP in Badges & Rewards.",
    Icon: Trophy,
    color: "gold",
  },
  {
    id: "path",
    eyebrow: "YOUR NEXT ADVENTURE",
    heading: "Your past adventures count too!",
    text: "Discover recommended workshops and future SAIT programs. Already completed a workshop, even before using this app? Find it in the workshop list and choose 'Previously Completed' to claim your XP.",
    Icon: Compass,
    color: "mint",
  },
];

export default function WelcomeTutorial({ user, student }) {
  const router = useRouter();
  const { updateStudentProfile } = useAuth();
  const [replay, setReplay] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const swipeStart = useRef(null);
  const skipRef = useRef(null);

  useEffect(() => {
    const openReplay = () => { setReplay(true); setDismissed(false); setIndex(0); setError(""); };
    window.addEventListener("student-tutorial-replay", openReplay);
    return () => window.removeEventListener("student-tutorial-replay", openReplay);
  }, []);

  const open = Boolean(user && student && !dismissed && (student.tutorialCompleted === false || replay));
  useEffect(() => { if (open) skipRef.current?.focus(); }, [open]);
  if (!open) return null;

  const card = CARDS[index];
  const Icon = card.Icon;
  const last = index === CARDS.length - 1;

  async function finish(goToWorkshops) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      // Replay does not need an extra database write.
      if (student.tutorialCompleted === false) {
        const response = await studentFetch("/api/student/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tutorialCompleted: true }),
        });
        const result = await response.json();
        if (!response.ok || result.success !== true) throw new Error(result.message || "Could not save tutorial progress.");
        updateStudentProfile(result.student);
      }
      setDismissed(true);
      setReplay(false);
      if (goToWorkshops) router.push("/workshops");
    } catch (cause) {
      setError(cause?.message || "Could not save your preference. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function endSwipe(event) {
    if (swipeStart.current == null || !event.changedTouches?.length) return;
    const delta = event.changedTouches[0].clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(delta) < 55) return;
    setIndex(current => delta < 0 ? Math.min(current + 1, CARDS.length - 1) : Math.max(0, current - 1));
  }

  return (
    <div className={styles.overlay} role="presentation">
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-tutorial-title"
        aria-describedby="student-tutorial-description"
        onTouchStart={event => { swipeStart.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={endSwipe}
        onKeyDown={event => {
          if (event.key === "ArrowRight") setIndex(current => Math.min(current + 1, CARDS.length - 1));
          if (event.key === "ArrowLeft") setIndex(current => Math.max(0, current - 1));
        }}
      >
        <div className={styles.top}>
          <div className={styles.brand}><span className={styles.brandMark}>S</span> SAIT Youth Initiatives</div>
          <button ref={skipRef} type="button" className={styles.skip} disabled={saving} onClick={() => finish(false)} aria-label="Skip welcome tutorial"><X size={16} aria-hidden="true"/> Skip</button>
        </div>
        <div className={styles.content} key={card.id}>
          <div className={styles.art + " " + styles[card.color]}><span className={styles.halo}/><Icon size={66} strokeWidth={1.7} aria-hidden="true"/></div>
          <p className={styles.eyebrow}>{card.eyebrow}</p>
          <h2 id="student-tutorial-title">{card.heading}</h2>
          <p id="student-tutorial-description">{card.text}</p>
          {last && <div className={styles.rewardNote}><Gift size={18} aria-hidden="true"/> Redeem your Current XP for SAIT swag at Youth Initiatives events!</div>}
        </div>
        <div className={styles.footer}>
          <div className={styles.dots} role="group" aria-label="Tutorial steps">
            {CARDS.map((item, position) => <button key={item.id} type="button" className={position === index ? styles.dotActive : styles.dot} aria-label={"Go to tutorial step " + (position + 1)} aria-current={position === index ? "step" : undefined} onClick={() => setIndex(position)} />)}
          </div>
          <div className={styles.controls}>
            {index > 0 && <button type="button" className={styles.back} disabled={saving} onClick={() => setIndex(index - 1)}><ChevronLeft size={17} aria-hidden="true"/> Back</button>}
            {last
              ? <button type="button" className={styles.next} disabled={saving} onClick={() => finish(true)}><CheckCircle2 size={17} aria-hidden="true"/>{saving ? "Saving…" : "Explore & claim workshops"}</button>
              : <button type="button" className={styles.next} onClick={() => setIndex(index + 1)}>Next <ChevronRight size={17} aria-hidden="true"/></button>}
          </div>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>
    </div>
  );
}
