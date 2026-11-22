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
  History,
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

const builtInBadgeIcons = {
  "first-step": Award,
  "tech-explorer": Cpu,
  "skill-builder": Medal,
  "curious-learner": Sparkles,
  "workshop-champion": Trophy,
};

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

  const [redemptions, setRedemptions] = useState([]);
  const [redemptionLoading, setRedemptionLoading] = useState(true);
  const [redemptionError, setRedemptionError] = useState("");

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

    // History is independent of badges: a failed ledger request must not
    // hide a student's XP balance or badge collection.
    async function loadRedemptions() {
      setRedemptionLoading(true);
      setRedemptionError("");
      try {
        const response = await studentFetch("/api/rewards/history", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.redemptions)) {
          throw new Error(data.message || "Redemption history could not be loaded.");
        }
        if (!cancelled) setRedemptions(data.redemptions);
      } catch (error) {
        if (!cancelled) setRedemptionError(error.message || "Redemption history could not be loaded.");
      } finally {
        if (!cancelled) setRedemptionLoading(false);
      }
    }

    void loadRedemptions();

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
      const recordedIds = (gameData?.badges || []).map(badge =>
        badge.badgeId || badge.id?.split("_").at(-1)
      );
      return new Set([...recordedIds, ...(gameData?.earnedBadgeIds || [])]);
    }, [gameData]);

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

  const badgeCatalog = (gameData.badgeCatalog || []).filter(badge =>
    badge.status === "active" || earnedBadgeIds.has(badge.id)
  );
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
              Complete experiences, earn XP, and unlock badges. Spend your available XP on rewards at SAIT events.
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
                Lifetime XP
              </span>
            </div>

            <div>
              <Gift size={23} />
              <strong>{gameData.currentXp ?? gameData.totalXp}</strong>
              <span>XP available to spend</span>
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
                If you choose a reward, SAIT staff will redeem it in person and subtract the required XP from your XP available to spend.
              </p>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-white px-4 py-3">
                <strong className="text-2xl font-black text-slate-900" aria-label={`XP available to spend: ${gameData.currentXp ?? gameData.totalXp}`}>
                  {gameData.currentXp ?? gameData.totalXp} XP
                </strong>
                <span className="text-sm font-semibold text-slate-600">XP available to spend at SAIT events</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                XP available to spend decreases when staff redeem rewards. Lifetime XP tracks the XP you have earned and determines your level; redeeming rewards never reduces it. If an incorrect experience completion is reversed, staff may correct your earned XP.
                Rewards vary by event, and online redemption is not available.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="badges-redemption-history-heading"
          className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <History size={24} aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-violet-700">YOUR XP SPENDING</span>
              <h2 id="badges-redemption-history-heading" className="mt-1 text-xl font-extrabold text-slate-900">Redemption history</h2>
              <p className="mt-1 text-sm text-slate-600">
                See when and where you spent XP at SAIT events. Only completed redemptions appear here.
              </p>
            </div>
          </div>

          {redemptionLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
              <LoaderCircle className="button-spinner" size={18} /> Loading redemption history...
            </p>
          ) : redemptionError ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {redemptionError}
            </p>
          ) : redemptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5">
              <p className="font-bold text-slate-800">No rewards redeemed yet</p>
              <p className="mt-1 text-sm text-slate-600">When you spend XP at a SAIT event, your completed redemptions will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[400px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">Date</th>
                    <th scope="col" className="px-4 py-3">Event / reward</th>
                    <th scope="col" className="px-4 py-3 text-right">XP spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {redemptions.map(item => (
                    <tr key={item.id} className="text-slate-700">
                      <td className="whitespace-nowrap px-4 py-3">
                        {new Date(item.date).toLocaleDateString("en-CA", {
                          year: "numeric", month: "short", day: "numeric",
                          timeZone: "America/Edmonton",
                        })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.event}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold text-rose-700">
                        -{item.xpSpent} XP
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

              const progress = {
                current: Math.min(badge.current, badge.target),
                target: badge.target,
              };
              const progressPercentage = Math.round(progress.current / progress.target * 100);
              const Icon = builtInBadgeIcons[badge.id] || Award;

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
                      {badge.artworkUrl ? (
                        <span aria-hidden="true" className="h-12 w-12 rounded-lg bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: "url(" + JSON.stringify(badge.artworkUrl) + ")" }} />
                      ) : <Icon size={37} />}
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
              {unlockedCount < badgeCatalog.length ? "Your next badge is waiting." : "Keep building your skills."}
            </h2>

            <p>
              Try another experience. Keep earning XP.
            </p>
          </div>

          <Link href="/workshops">
            Explore Experiences
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
            Experiences
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