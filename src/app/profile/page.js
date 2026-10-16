"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Compass,
  Edit3,
  GraduationCap,
  Heart,
  LockKeyhole,
  LogOut,
  Mail,
  MonitorPlay,
  Orbit,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  WandSparkles,
  Zap,
} from "lucide-react";

import { auth } from "@/services/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { studentFetch } from "@/services/studentApi";
import {
  formatLearningPreference,
  formatStudentBirthDate,
  formatStudentInterest,
  profileProgress,
  studentContactEmail,
  studentDisplayName,
  studentInitials,
  studentInterests,
  studentYouthId,
} from "@/utils/studentProfileDisplay.mjs";
import styles from "./profileAdventure.module.css";

const interestIcons = {
  coding: "💻",
  "artificial intelligence": "🤖",
  robotics: "🦾",
  "skilled trades": "🛠️",
  business: "💡",
  design: "🎨",
  health: "💚",
  aviation: "✈️",
  culinary: "🧁",
};

function StatTile({ Icon, count, label, className }) {
  return (
    <div className={`${styles.statTile} ${className || ""}`}>
      <span className={styles.statIcon}><Icon size={23} aria-hidden="true" /></span>
      <strong>{count}</strong>
      <span>{label}</span>
    </div>
  );
}

function InfoRow({ Icon, label, value, placeholder, emphasized = false }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoIcon}><Icon size={19} aria-hidden="true" /></span>
      <div>
        <span className={styles.infoLabel}>{label}</span>
        <strong className={`${styles.infoValue} ${emphasized ? styles.highlightValue : ""}`}>
          {value || <span className={styles.missingValue}>{placeholder || "Not available"}</span>}
        </strong>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, studentProfile, loading: authLoading } = useAuth();

  const [freshStudent, setFreshStudent] = useState(null);
  const [gamification, setGamification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [profileError, setProfileError] = useState("");
  const [gamificationError, setGamificationError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setProfileError("");
      setGamificationError("");

      const [profileResult, progressResult] = await Promise.allSettled([
        studentFetch("/api/student/profile", { cache: "no-store" }),
        studentFetch("/api/gamification", { cache: "no-store" }),
      ]);

      if (cancelled) return;

      if (profileResult.status === "fulfilled") {
        try {
          const data = await profileResult.value.json();
          if (!profileResult.value.ok || !data?.student) {
            throw new Error(data?.message || "Profile information could not be refreshed.");
          }
          if (!cancelled) setFreshStudent({ uid: user.uid, data: data.student });
        } catch (error) {
          if (!cancelled) setProfileError(error.message || "Could not refresh your profile.");
        }
      } else {
        setProfileError("Could not refresh your profile from the server.");
      }

      if (progressResult.status === "fulfilled") {
        try {
          const data = await progressResult.value.json();
          if (!progressResult.value.ok || !data?.gamification) {
            throw new Error(data?.message || "Progress is unavailable.");
          }
          if (!cancelled) setGamification({ uid: user.uid, data: data.gamification });
        } catch {
          if (!cancelled) setGamificationError("Latest achievements could not be refreshed.");
        }
      } else {
        setGamificationError("Latest achievements could not be refreshed.");
      }

      if (!cancelled) setLoading(false);
    }

    loadProfile();
    return () => { cancelled = true; };
  }, [user, authLoading, refreshKey]);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      setLogoutError("");
      await signOut(auth);
      router.replace("/login");
    } catch {
      setLogoutError("Could not log out. Please try again.");
      setLoggingOut(false);
    }
  }

  const authenticatedFresh = user && freshStudent?.uid === user.uid ? freshStudent.data : null;
  const authenticatedProgress = user && gamification?.uid === user.uid ? gamification.data : null;

  if (authLoading || (user && loading && !studentProfile && !authenticatedFresh)) {
    return (
      <main className={styles.statusPage} role="status">
        <Sparkles size={34} className={styles.statusSparkle} aria-hidden="true" />
        <h1>Preparing your explorer passport...</h1>
        <p>Gathering your student details and achievements.</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.statusPage}>
        <LockKeyhole size={35} aria-hidden="true" />
        <h1>Log in to see your passport</h1>
        <p>Your Skill Quest profile belongs to you.</p>
        <Link href="/login" className={styles.primaryAction}>Go to Login <ArrowRight size={17} aria-hidden="true" /></Link>
      </main>
    );
  }

  const student = authenticatedFresh || studentProfile;

  if (!student) {
    return (
      <main className={styles.statusPage}>
        <CircleHelp size={35} aria-hidden="true" />
        <h1>We could not load your profile</h1>
        <p>{profileError || "Your student information is temporarily unavailable."}</p>
        <button type="button" className={styles.primaryAction} onClick={() => setRefreshKey(value => value + 1)}>
          <RefreshCcw size={17} aria-hidden="true" /> Try Again
        </button>
      </main>
    );
  }

  const name = studentDisplayName(student);
  const initials = studentInitials(student);
  const youthId = studentYouthId(student);
  const email = studentContactEmail(student);
  const birthDate = formatStudentBirthDate(student.dateOfBirth);
  const interests = studentInterests(student);
  const progress = profileProgress(student, authenticatedProgress);
  const badges = Array.isArray(authenticatedProgress?.badges) ? authenticatedProgress.badges : [];
  const xpToGo = progress.nextLevelXp == null ? null : Math.max(0, Number(progress.nextLevelXp) - progress.totalXp);

  return (
    <main className={styles.profilePage}>
      <section className={styles.hero} aria-labelledby="profile-heading">
        <span className={styles.heroBubbleOne} aria-hidden="true" />
        <span className={styles.heroBubbleTwo} aria-hidden="true" />
        <span className={styles.heroStarOne} aria-hidden="true">✦</span>
        <span className={styles.heroStarTwo} aria-hidden="true">✳</span>

        <div className={styles.heroInner}>
          <div className={styles.heroIntro}>
            <span className={styles.eyebrow}><Sparkles size={17} aria-hidden="true"/> MY SKILL QUEST PASSPORT</span>
            <h1 id="profile-heading">My Explorer Profile</h1>
            <p>Every adventure begins with you. Discover the skills you&apos;ve built and where your curiosity can take you next.</p>
          </div>
          <Link href="/edit-profile" className={styles.editButton}>
            <Edit3 size={17} aria-hidden="true"/> Edit My Preferences
          </Link>
        </div>

        <div className={styles.passport}>
          <div className={styles.avatarShell} aria-label={`Avatar initials: ${initials}`}>
            <span className={styles.avatarRing} aria-hidden="true" />
            <span className={styles.avatar}>{initials}</span>
            <span className={styles.avatarStar} aria-hidden="true"><Star size={17} fill="currentColor"/></span>
          </div>
          <div className={styles.passportIdentity}>
            <span className={styles.passportWelcome}>WELCOME, EXPLORER!</span>
            <h2>{name}</h2>
            <div className={styles.passportChips}>
              <span><ShieldCheck size={16} aria-hidden="true"/> Active Explorer</span>
              <span><Rocket size={16} aria-hidden="true"/> Level {progress.level}</span>
              <span><Trophy size={16} aria-hidden="true"/> {progress.rank}</span>
            </div>
          </div>
          <div className={styles.passportSeal}>
            <span className={styles.sealIcon}><WandSparkles size={28} aria-hidden="true"/></span>
            <span>OFFICIAL</span>
            <strong>Skill Quest</strong>
            <small>Adventure Passport</small>
          </div>
        </div>
      </section>

      <section className={styles.content}>
        {profileError && (
          <div className={styles.warning} role="status">
            <CircleHelp size={19} aria-hidden="true"/>
            <span>{profileError} Showing your last authenticated profile information.</span>
            <button type="button" onClick={() => setRefreshKey(value => value + 1)}>Retry</button>
          </div>
        )}

        <div className={styles.statsGrid} aria-label="My learning achievements">
          <StatTile Icon={Zap} count={progress.totalXp} label="Total XP" className={styles.tileGold}/>
          <StatTile Icon={Star} count={progress.level} label="Explorer Level" className={styles.tilePurple}/>
          <StatTile Icon={Award} count={progress.badges} label="Badges Earned" className={styles.tilePink}/>
          <StatTile Icon={BookOpen} count={progress.completed} label="Workshops Completed" className={styles.tileMint}/>
        </div>

        <section className={styles.progressCard} aria-labelledby="level-heading">
          <div className={styles.progressIcon}><Orbit size={30} aria-hidden="true"/></div>
          <div className={styles.progressBody}>
            <div className={styles.progressTitle}>
              <div><span>YOUR NEXT MILESTONE</span><h2 id="level-heading">Level {progress.level} · {progress.rank}</h2></div>
              <strong>{xpToGo == null ? "Top Level!" : `${xpToGo} XP to go`}</strong>
            </div>
            <div className={styles.progressTrack} role="progressbar" aria-label="Progress to next explorer level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.progressPercentage}>
              <span style={{width: `${progress.progressPercentage}%`}}/>
            </div>
            <p>{xpToGo == null ? "Amazing! You have reached the current highest level." : "Keep attending workshops and earning verified XP to reach your next level."}</p>
          </div>
          <Link href="/journey" className={styles.progressLink}>View Map <ArrowRight size={16} aria-hidden="true"/></Link>
        </section>

        {gamificationError && (
          <p className={styles.subtleNotice} role="status">{gamificationError} Displaying your saved profile totals.</p>
        )}

        <div className={styles.columns}>
          <section className={styles.panel} aria-labelledby="identity-heading">
            <div className={styles.panelHeading}>
              <span className={styles.panelIcon}><UserRound size={23} aria-hidden="true"/></span>
              <div><span>MY IDENTITY</span><h2 id="identity-heading">Explorer Information</h2></div>
            </div>
            <p className={styles.panelLead}>Your own student details, securely loaded from your SAIT Youth Initiative account.</p>
            <div className={styles.infoList}>
              <InfoRow Icon={GraduationCap} label="Youth Initiative ID" value={youthId} placeholder="Please contact the program team" emphasized/>
              <InfoRow Icon={Mail} label="Contact Email" value={email} placeholder="No contact email is recorded"/>
              <InfoRow Icon={CalendarDays} label="Date of Birth" value={birthDate} placeholder="No date recorded"/>
              <InfoRow Icon={MonitorPlay} label="Learning Preference" value={formatLearningPreference(student.learningMode)}/>
            </div>
            <p className={styles.privateNote}><LockKeyhole size={16} aria-hidden="true"/> Your account details are private and visible only to you while signed in.</p>
          </section>

          <section className={styles.panel} aria-labelledby="interests-heading">
            <div className={styles.panelHeading}>
              <span className={styles.panelIconPurple}><Compass size={23} aria-hidden="true"/></span>
              <div><span>MY SKILL UNIVERSE</span><h2 id="interests-heading">Things I Love Exploring</h2></div>
              <Link href="/edit-profile" className={styles.miniEdit} aria-label="Edit interests"><Edit3 size={16} aria-hidden="true"/> Edit</Link>
            </div>
            <p className={styles.panelLead}>Choose the worlds you want to explore. Your interests help you discover workshops and future pathways.</p>
            {interests.length ? (
              <div className={styles.interestGrid}>
                {interests.map((interest) => (
                  <div className={styles.interestItem} key={interest}>
                    <span className={styles.interestEmoji} aria-hidden="true">{interestIcons[interest.toLowerCase()] || "🌟"}</span>
                    <strong>{formatStudentInterest(interest)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyInterests}>
                <span aria-hidden="true">🪐</span>
                <strong>Your Skill Universe is waiting!</strong>
                <p>Pick up to five interests to make your adventure more personal.</p>
                <Link href="/edit-profile">Choose Interests <ArrowRight size={16} aria-hidden="true"/></Link>
              </div>
            )}
            <div className={styles.worldFooter}>
              <Heart size={18} aria-hidden="true"/>
              {interests.length} of 5 interests selected
            </div>
          </section>
        </div>

        <section className={styles.adventureSection} aria-labelledby="continue-heading">
          <div className={styles.adventureHeading}>
            <div><span><Sparkles size={16} aria-hidden="true"/> KEEP EXPLORING</span><h2 id="continue-heading">Where will your next adventure take you?</h2></div>
            <p>Every workshop, badge, and challenge helps you discover more about yourself.</p>
          </div>
          <div className={styles.actionGrid}>
            <Link href="/journey" className={styles.actionCard}>
              <span className={styles.actionArtwork}><Rocket size={31} aria-hidden="true"/></span>
              <strong>Adventure Map</strong>
              <small>Follow your learning journey</small>
              <ChevronRight size={19} aria-hidden="true"/>
            </Link>
            <Link href="/badges" className={styles.actionCard}>
              <span className={styles.actionArtwork}><Trophy size={31} aria-hidden="true"/></span>
              <strong>Badge Collection</strong>
              <small>See what you&apos;ve unlocked</small>
              <ChevronRight size={19} aria-hidden="true"/>
            </Link>
            <Link href="/completed-workshops" className={styles.actionCard}>
              <span className={styles.actionArtwork}><BookOpen size={31} aria-hidden="true"/></span>
              <strong>My Workshops</strong>
              <small>Celebrate what you&apos;ve learned</small>
              <ChevronRight size={19} aria-hidden="true"/>
            </Link>
          </div>
          {badges.length > 0 && (
            <div className={styles.earnedPreview}>
              <span><CheckCircle2 size={17} aria-hidden="true"/> Recently unlocked achievements</span>
              <div>
                {badges.slice(0, 3).map((badge, index) => (
                  <span key={badge.id || badge.badgeId || index}><Award size={16} aria-hidden="true"/>{badge.name || badge.badgeId || "Achievement"}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className={styles.bottomActions}>
          <Link href="/workshops" className={styles.exploreLink}><Sparkles size={18} aria-hidden="true"/> Explore New Workshops <ArrowRight size={17} aria-hidden="true"/></Link>
          <button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={loggingOut}>
            <LogOut size={17} aria-hidden="true"/>{loggingOut ? "Logging Out..." : "Log Out"}
          </button>
        </div>
        {logoutError && <p className={styles.warning} role="alert">{logoutError}</p>}
      </section>
    </main>
  );
}
