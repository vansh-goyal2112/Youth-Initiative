"use client";

import Link from "next/link";
import playfulSkin from "@/components/gamification/playfulSkin.module.css";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Award,
  BookOpen,
  CheckCircle2,
  Cpu,
  Gift,
  Home,
  LoaderCircle,
  Lock,
  Map,
  Medal,
  Sparkles,
  Star,
  Trophy,
  UserRound,
} from "lucide-react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import {
  studentFetch,
} from "@/services/studentApi";

const builtinBadgeCatalog = [
  {
    id: "first-step",
    name: "First Step",
    description:
      "Complete your first workshop.",
    icon: Award,
    type: "completed",
    target: 1,
  },
  {
    id: "tech-explorer",
    name: "Tech Explorer",
    description:
      "Complete a Technology workshop.",
    icon: Cpu,
    type: "technology",
    target: 1,
  },
  {
    id: "skill-builder",
    name: "Skill Builder",
    description:
      "Complete 3 workshops.",
    icon: Medal,
    type: "completed",
    target: 3,
  },
  {
    id: "curious-learner",
    name: "Curious Learner",
    description:
      "Explore 3 different skill areas.",
    icon: Sparkles,
    type: "categories",
    target: 3,
  },
  {
    id: "workshop-champion",
    name: "Workshop Champion",
    description:
      "Complete 5 workshops.",
    icon: Trophy,
    type: "completed",
    target: 5,
  },
];

export default function BadgesPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [
    gameData,
    setGameData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    if (
      authLoading ||
      !user
    ) {
      return;
    }

    let cancelled =
      false;

    async function loadBadges() {
      try {
        setErrorMessage("");

        const response =
          await studentFetch(
            "/api/gamification"
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Badge progress could not be loaded."
          );
        }

        if (
          !cancelled
        ) {
          setGameData(
            data.gamification
          );
        }
      } catch (error) {
        console.error(
          "Load badges error:",
          error
        );

        if (
          !cancelled
        ) {
          setErrorMessage(
            error.message ||
              "Badge progress could not be loaded."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    loadBadges();

    return () => {
      cancelled =
        true;
    };
  }, [
    user,
    authLoading,
  ]);

  const earnedBadgeIds =
    useMemo(() => {
      if (
        !gameData?.badges
      ) {
        return new Set();
      }

      const ids =
        gameData.badges.map(
          (badge) => {
            if (
              badge.badgeId
            ) {
              return badge.badgeId;
            }

            const firestoreId =
              badge.id || "";

            const parts =
              firestoreId.split(
                "_"
              );

            return parts[
              parts.length -
                1
            ];
          }
        );

      return new Set(
        ids
      );
    }, [
      gameData,
    ]);

  function getBadgeProgress(
    badge
  ) {
    if (badge.type === "custom") return { current: badge.current || 0, target: badge.target };
    if (!gameData) {
      return {
        current: 0,
        target:
          badge.target,
      };
    }

    if (
      badge.type ===
      "completed"
    ) {
      return {
        current:
          Math.min(
            gameData.completedWorkshops,
            badge.target
          ),

        target:
          badge.target,
      };
    }

    if (
      badge.type ===
      "categories"
    ) {
      return {
        current:
          Math.min(
            gameData.categoryCount,
            badge.target
          ),

        target:
          badge.target,
      };
    }

    if (
      badge.type ===
      "technology"
    ) {
      const technologyTrack =
        gameData.skillTracks.find(
          (track) =>
            track.category ===
            "Technology"
        );

      return {
        current:
          Math.min(
            technologyTrack?.completed ||
              0,
            badge.target
          ),

        target:
          badge.target,
      };
    }

    return {
      current: 0,
      target:
        badge.target,
    };
  }

  if (
    authLoading ||
    (
      user &&
      loading
    )
  ) {
    return (
      <main className="badges-status-page">
        <LoaderCircle
          size={36}
          className="button-spinner"
        />

        <p>
          Loading your
          achievements...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="badges-status-page">
        <h1>
          Login Required
        </h1>

        <p>
          Log in to view your
          badges and progress.
        </p>

        <Link href="/login">
          Login
        </Link>
      </main>
    );
  }

  if (
    !gameData ||
    errorMessage
  ) {
    return (
      <main className="badges-status-page">
        <h1>
          Badges unavailable
        </h1>

        <p>
          {errorMessage}
        </p>
      </main>
    );
  }

  const badgeCatalog = [
    ...builtinBadgeCatalog,
    ...(gameData.customBadgeCatalog || []).filter(badge => badge.status === "active" ||
      earnedBadgeIds.has(badge.id)).map(badge => ({ ...badge, type: "custom", icon: Award })),
  ];
  const unlockedCount =
    badgeCatalog.filter(
      (badge) =>
        earnedBadgeIds.has(
          badge.id
        )
    ).length;

  return (
    <main className={`badges-page ${playfulSkin.badgeShell}`}>
      <section className="badges-hero">
        <div className="student-content-container badges-hero-content">
          <div>
            <span className="badges-label">
              <Sparkles
                size={15}
              />

              ACHIEVEMENTS
            </span>

            <h1>
              Badges &amp; Rewards
            </h1>

            <p>
              Complete workshops, earn XP, and unlock badges. Redeem your Current XP in person at SAIT events.
            </p>
          </div>

          <div className="badges-hero-summary">
            <div>
              <Trophy
                size={23}
              />

              <strong>
                {
                  unlockedCount
                }
              </strong>

              <span>
                Unlocked
              </span>
            </div>

            <div>
              <Star
                size={23}
              />

              <strong>
                {
                  gameData.totalXp
                }
              </strong>

              <span>
                Total XP
              </span>
            </div>

            <div>
              <Gift size={23} />
              <strong>{gameData.currentXp ?? gameData.totalXp}</strong>
              <span>Current XP · Available to redeem</span>
            </div>

            <div>
              <Award
                size={23}
              />

              <strong>
                {
                  gameData.level
                }
              </strong>

              <span>
                Level
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="student-content-container badges-content">
        <section aria-labelledby="badges-rewards-how-heading"
          className="mb-8 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-violet-50 p-5 shadow-sm md:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Gift size={26} aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-amber-800">In-person rewards</span>
              <h2 id="badges-rewards-how-heading" className="mt-1 text-xl font-extrabold text-slate-900">
                How rewards work
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 md:text-base">
                Bring your XP to SAIT events. Staff will show you the rewards available that day.
                If you choose a reward, SAIT staff will redeem it in person and subtract the required XP from your Current XP balance.
              </p>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-white px-4 py-3">
                <strong className="text-2xl font-black text-slate-900" aria-label={`Current XP available to redeem: ${gameData.currentXp ?? gameData.totalXp}`}>
                  {gameData.currentXp ?? gameData.totalXp} XP
                </strong>
                <span className="text-sm font-semibold text-slate-600">Available to redeem at SAIT events</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                Total XP tracks how much you have earned across your journey; Current XP is what you can still redeem.
                Rewards vary by event, and online redemption is not available.
              </p>
            </div>
          </div>
        </section>

        <div className="badges-section-heading">
          <div>
            <span>
              BADGE COLLECTION
            </span>

            <h2>
              Unlock Your
              Achievements
            </h2>
          </div>

          <p>
            {unlockedCount} of{" "}
            {
              badgeCatalog.length
            }{" "}
            badges unlocked
          </p>
        </div>

        <div className="badges-grid">
          {badgeCatalog.map(
            (badge) => {
              const unlocked =
                earnedBadgeIds.has(
                  badge.id
                );

              const progress =
                getBadgeProgress(
                  badge
                );

              const progressPercentage =
                Math.min(
                  100,
                  Math.round(
                    (progress.current /
                      progress.target) *
                      100
                  )
                );

              const Icon =
                badge.icon;

              return (
                <article
                  key={
                    badge.id
                  }
                  className={`badge-card ${
                    unlocked
                      ? "badge-unlocked"
                      : "badge-locked"
                  }`}
                >
                  <div className="badge-medal-wrapper">
                    <div className="badge-medal-ring">
                      <Icon
                        size={37}
                      />
                    </div>

                    {unlocked ? (
                      <span className="badge-unlocked-indicator">
                        <CheckCircle2
                          size={17}
                        />
                      </span>
                    ) : (
                      <span className="badge-lock-indicator">
                        <Lock
                          size={15}
                        />
                      </span>
                    )}
                  </div>

                  <span className="badge-state-label">
                    {unlocked
                      ? "ACHIEVEMENT UNLOCKED"
                      : "LOCKED"}
                  </span>

                  <h3>
                    {
                      badge.name
                    }
                  </h3>

                  <p>
                    {
                      badge.description
                    }
                  </p>

                  {unlocked ? (
                    <div className="badge-complete-message">
                      <CheckCircle2
                        size={16}
                      />

                      Badge earned
                    </div>
                  ) : (
                    <div className="badge-progress-area">
                      <div className="badge-progress-heading">
                        <span>
                          Progress
                        </span>

                        <strong>
                          {
                            progress.current
                          }
                          {" / "}
                          {
                            progress.target
                          }
                        </strong>
                      </div>

                      <div
                        className="badge-progress-track"
                        role="progressbar"
                        aria-label={`${badge.name} progress`}
                        aria-valuemin={0}
                        aria-valuemax={progress.target}
                        aria-valuenow={progress.current}
                      >
                        <div
                          className="badge-progress-value"
                          style={{
                            width:
                              `${progressPercentage}%`,
                          }}
                        />
                      </div>

                      <small>
                        {
                          progressPercentage
                        }
                        % complete
                      </small>
                    </div>
                  )}
                </article>
              );
            }
          )}
        </div>

        <section className="badges-next-goal">
          <div className="badges-next-goal-icon">
            <Trophy
              size={31}
            />
          </div>

          <div>
            <span>
              KEEP GOING
            </span>

            <h2>
              Your next badge is
              waiting.
            </h2>

            <p>
              Try another workshop. Keep earning XP.
            </p>
          </div>

          <Link href="/workshops">
            Explore Workshops
          </Link>
        </section>
      </section>

      <nav className="student-bottom-navigation">
        <Link href="/dashboard">
          <Home
            size={20}
          />

          <span>
            Home
          </span>
        </Link>

        <Link href="/workshops">
          <BookOpen
            size={20}
          />

          <span>
            Workshops
          </span>
        </Link>

        <Link href="/journey">
          <Map
            size={20}
          />

          <span>
            Journey
          </span>
        </Link>

        <Link
          href="/badges"
          className="active"
        >
          <Trophy
            size={20}
          />

          <span>
            Badges
          </span>
        </Link>

        <Link href="/profile">
          <UserRound
            size={20}
          />

          <span>
            Profile
          </span>
        </Link>
      </nav>
    </main>
  );
}