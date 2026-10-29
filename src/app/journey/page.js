"use client";

import Link from "next/link";
import AdventureTrail from "@/components/gamification/AdventureTrail";
import JournalStamps from "@/components/gamification/JournalStamps";
import playfulSkin from "@/components/gamification/playfulSkin.module.css";
import {
  useEffect,
  useState,
} from "react";

import {
  Award,
  BookOpen,
  Compass,
  Cpu,
  Home,
  LoaderCircle,
  Map,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  Zap,
  GraduationCap,
  ExternalLink,
} from "lucide-react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import {
  studentFetch,
} from "@/services/studentApi";

export default function JourneyPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [gameData, setGameData] =
    useState(null);

  const [pathways, setPathways] =
    useState([]);

  const [registrations, setRegistrations] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [rewardStatus, setRewardStatus] = useState("");

  useEffect(() => {
    if (
      authLoading ||
      !user
    ) {
      return;
    }

    let cancelled =
      false;

    async function loadGameProgress() {
      try {
        // Independent optional data can start while reward reconciliation
        // runs. Keep the page's existing final loading state and XP
        // ordering unchanged.
        const optionalData = (async () => {
          const results = await Promise.allSettled([
            studentFetch("/api/registrations").then(async (response) =>
              response.ok ? (await response.json()).registrations || [] : null
            ),
            studentFetch("/api/pathways/recommendations").then(async (response) =>
              response.ok ? (await response.json()).recommendations || [] : null
            ),
          ]);
          if (cancelled) return;
          if (results[0].status === "fulfilled" && results[0].value !== null) {
            setRegistrations(results[0].value);
          }
          if (results[1].status === "fulfilled" && results[1].value !== null) {
            setPathways(results[1].value);
          }
        })();

        // Reconcile only genuinely verified attendance. A processing
        // transaction is never blindly replayed to avoid double XP.
        try {
          const reconciliation = await studentFetch(
            "/api/gamification/reconcile",
            { method: "POST" }
          );
          if (reconciliation.ok) {
            const result = await reconciliation.json();
            if (!cancelled) {
              setRewardStatus(
                result.pendingCount > 0
                  ? "Some workshop rewards are still processing. Your verified attendance is safe."
                  : ""
              );
            }
          }
        } catch (error) {
          // The student's journey must stay available even if a
          // temporary rewards-recovery request cannot finish.
          console.warn("Reward reconciliation unavailable:", error);
        }

        const response =
          await studentFetch(
            "/api/gamification"
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message
          );
        }

        if (
          !cancelled
        ) {
          setGameData(
            data.gamification
          );
        }

        await optionalData;

      } catch (error) {
        if (
          !cancelled
        ) {
          setErrorMessage(
            error.message ||
              "Progress could not be loaded."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(false);
        }
      }
    }

    loadGameProgress();

    return () => {
      cancelled =
        true;
    };
  }, [
    user,
    authLoading,
  ]);

  if (
    authLoading ||
    (
      user &&
      loading
    )
  ) {
    return (
      <main className="game-loading">
        <LoaderCircle
          className="button-spinner"
          size={36}
        />

        Loading your journey...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="game-loading">
        <h1>Login Required</h1>

        <Link href="/login">
          Login
        </Link>
      </main>
    );
  }

  if (
    errorMessage ||
    !gameData
  ) {
    return (
      <main className="game-loading">
        <h1>
          Journey unavailable
        </h1>

        <p>{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className={`journey-game-page ${playfulSkin.journeyShell}`}>

      <section className="journey-game-hero">
        <div className="journey-game-glow journey-game-glow-one" />
        <div className="journey-game-glow journey-game-glow-two" />

        <div className="student-content-container">

          <span className="journey-game-label">
            <Sparkles size={15} />
            MY SKILL QUEST
          </span>

          <div className="journey-player-card">

            <div className="journey-level-circle">
              <span>
                LEVEL
              </span>

              <strong>
                {gameData.level}
              </strong>
            </div>

            <div className="journey-player-info">

              <span>
                Current Rank
              </span>

              <h1>
                {gameData.rank}
              </h1>

              <div className="journey-level-progress">

                <div className="journey-level-progress-heading">
                  <span>
                    {gameData.totalXp} XP
                  </span>

                  {gameData.nextLevelXp && (
                    <span>
                      {gameData.nextLevelXp} XP
                    </span>
                  )}
                </div>

                <div className="journey-progress-track">
                  <div
                    className="journey-progress-value"
                    style={{
                      width:
                        `${gameData.progressPercentage}%`,
                    }}
                  />
                </div>

                {gameData.nextLevelXp ? (
                  <p>
                    {gameData.nextLevelXp -
                      gameData.totalXp}{" "}
                    XP until your next level
                  </p>
                ) : (
                  <p>
                    Maximum level achieved!
                  </p>
                )}
              </div>
            </div>

            <div className="journey-xp-display">
              <Star size={24} />

              <strong>
                {gameData.totalXp}
              </strong>

              <span>
                Total XP
              </span>
            </div>

          </div>

        </div>
      </section>


      <section className="student-content-container journey-game-content">
        {rewardStatus && (
          <p role="status" className={playfulSkin.rewardNotice}>
            {rewardStatus}
          </p>
        )}

        <AdventureTrail
          quests={gameData.quests || []}
          totalXp={gameData.totalXp}
        />

        <JournalStamps registrations={registrations} />

        <div className="journey-game-stats">

          <GameStat
            icon={BookOpen}
            value={
              gameData.completedWorkshops
            }
            label="Completed"
          />

          <GameStat
            icon={Award}
            value={
              gameData.badgeCount
            }
            label="Badges"
          />

          <GameStat
            icon={Compass}
            value={
              gameData.categoryCount
            }
            label="Skills Explored"
          />

          <GameStat
            icon={Zap}
            value={
              gameData.level
            }
            label="Level"
          />

        </div>


        <section className="skill-track-section">

          <div className="game-section-heading">

            <div>
              <span>
                SKILL PROGRESSION
              </span>

              <h2>
                Your Skill Tracks
              </h2>
            </div>

            <p>
              Each workshop strengthens a
              different skill pathway.
            </p>

          </div>

          {gameData.skillTracks.length ===
          0 ? (
            <div className="game-empty-card">
              <Compass size={42} />

              <h3>
                Your skill journey starts here
              </h3>

              <p>
                Complete workshops to start
                building your skill tracks.
              </p>

              <Link href="/workshops">
                Explore Workshops
              </Link>
            </div>
          ) : (
            <div className="skill-track-grid">

              {gameData.skillTracks.map(
                (track) => (
                  <SkillTrackCard
                    key={
                      track.category
                    }
                    track={track}
                  />
                )
              )}

            </div>
          )}

        </section>


        {/* FUTURE SAIT PATHWAYS SECTION */}
        {pathways.length > 0 && (
          <section className="quest-section">
            <div className="game-section-heading">
              <div>
                <span>FUTURE PATHWAYS</span>
                <h2>Recommended SAIT Programs</h2>
              </div>
              <p>
                Possible post-secondary pathways after Grade 12 tailored to your interests and completed workshops.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              {pathways.map((rec) => (
                <div
                  key={rec.program.id}
                  className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Sparkles size={12} />
                        {rec.score}% MATCH
                      </span>
                      <GraduationCap size={18} className="text-slate-400" />
                    </div>

                    <h3 className="text-base font-bold text-slate-800 line-clamp-2 mb-2">
                      {rec.program.title}
                    </h3>

                    <div className="space-y-1.5 mb-4">
                      {rec.reasons?.map((reason, idx) => (
                        <p
                          key={idx}
                          className="text-xs text-slate-600 flex items-start gap-1.5"
                        >
                          <span className="text-emerald-500 font-bold mt-0.5">•</span>
                          <span>{reason}</span>
                        </p>
                      ))}
                    </div>
                  </div>

                  <a
                    href={rec.program.informationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <span>View SAIT Program</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="journey-achievement-section">

          <div className="journey-achievement-icon">
            <Trophy size={35} />
          </div>

          <div>
            <span>
              YOUR NEXT MILESTONE
            </span>

            <h2>
              Keep building your journey.
            </h2>

            <p>
              Every verified workshop gives
              you XP, builds a skill track
              and brings you closer to your
              next achievement.
            </p>
          </div>

          <Link href="/workshops">
            Find My Next Workshop
          </Link>

        </section>

      </section>


      <nav className="student-bottom-navigation">

        <Link href="/dashboard">
          <Home size={20} />
          <span>Home</span>
        </Link>

        <Link href="/workshops">
          <BookOpen size={20} />
          <span>Workshops</span>
        </Link>

        <Link
          href="/journey"
          className="active"
        >
          <Map size={20} />
          <span>Journey</span>
        </Link>

        <Link href="/badges">
          <Trophy size={20} />
          <span>Badges</span>
        </Link>

        <Link href="/profile">
          <UserRound size={20} />
          <span>Profile</span>
        </Link>

      </nav>

    </main>
  );
}


function GameStat({
  icon: Icon,
  value,
  label,
}) {
  return (
    <div className="journey-stat-card">
      <Icon size={23} />

      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>
    </div>
  );
}


function SkillTrackCard({
  track,
}) {
  return (
    <article className="skill-track-card">

      <div className="skill-track-top">

        <div className="skill-track-icon">
          <Cpu size={22} />
        </div>

        <span>
          Level {track.level}
        </span>

      </div>

      <h3>
        {track.category}
      </h3>

      <p>
        {track.completed} workshop
        {track.completed !== 1
          ? "s"
          : ""}{" "}
        completed
      </p>

      <div className="skill-track-progress">
        <div
          style={{
            width:
              `${track.progressPercentage}%`,
          }}
        />
      </div>

      <div className="skill-track-footer">
        <span>
          {track.xp} Skill XP
        </span>

        <span>
          {track.progressPercentage}%
        </span>
      </div>

    </article>
  );
}


