"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, CalendarDays, ChevronRight, Compass, ExternalLink,
  GraduationCap, Home, LoaderCircle, Map, Sparkles, Star, Trophy, UserRound,
} from "lucide-react";
import AdventureTrail from "@/components/gamification/AdventureTrail";
import WorkshopArtwork from "@/components/workshops/WorkshopArtwork";
import playfulSkin from "@/components/gamification/playfulSkin.module.css";
import { useAuth } from "@/contexts/AuthContext";
import { studentFetch } from "@/services/studentApi";
import { recommendYouthWorkshops } from "@/utils/youthWorkshopRecommendations.mjs";
import { findJourneyUpcomingSessions } from "@/utils/journeyUpcomingSessions.mjs";
import { formatWorkshopDate } from "@/utils/workshopDate.mjs";
import { adventureJourney } from "@/utils/adventureJourney.mjs";
import { workshopDateLabel } from "@/utils/upcomingWorkshops.mjs";

export default function JourneyPage() {
  const { user, student, loading: authLoading } = useAuth();
  const [gameData, setGameData] = useState(null);
  const [pathways, setPathways] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [catalogueStatus, setCatalogueStatus] = useState("loading");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [rewardStatus, setRewardStatus] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    async function loadGameProgress() {
      setLoading(true);
      setCatalogueStatus("loading");
      setErrorMessage("");

      // XP progress is the critical data. Discovery panels load independently
      // so a slow or unavailable catalogue cannot hide a student's Journey.
      const progressRequest = studentFetch("/api/gamification");
      let finishInitialProgress;
      const initialProgressSettled = new Promise(resolve => {
        finishInitialProgress = resolve;
      });

      void (async () => {
        const requests = await Promise.allSettled([
          studentFetch("/api/pathways/recommendations"),
          studentFetch("/api/workshops", { cache: "no-store" }),
          studentFetch("/api/registrations", { cache: "no-store" }),
        ]);
        const [pathwayRequest, workshopRequest, registrationRequest] = requests;
        async function extract(request) {
          if (request.status !== "fulfilled" || !request.value.ok) return null;
          try { return await request.value.json(); } catch { return null; }
        }
        const [pathwayData, workshopData, registrationData] = await Promise.all([
          extract(pathwayRequest), extract(workshopRequest), extract(registrationRequest),
        ]);
        if (cancelled) return;
        setCatalogueStatus(Array.isArray(workshopData?.workshops) && Array.isArray(registrationData?.registrations)
          ? "ready" : "unavailable");
        if (Array.isArray(pathwayData?.recommendations)) setPathways(pathwayData.recommendations);
        if (Array.isArray(workshopData?.workshops)) setWorkshops(workshopData.workshops);
        if (Array.isArray(registrationData?.registrations)) setRegistrations(registrationData.registrations);
      })();

      void (async () => {
        try {
          // Keep the existing authenticated reward reconciliation safeguards.
          const response = await studentFetch("/api/gamification/reconcile", { method: "POST" });
          if (!response.ok) return;
          const result = await response.json();
          if (cancelled) return;
          setRewardStatus(result.pendingCount > 0
            ? "Some experience rewards are still processing. Your verified attendance is safe."
            : "");
          await initialProgressSettled;
          if (cancelled) return;
          const refreshed = await studentFetch("/api/gamification");
          if (!refreshed.ok) return;
          const data = await refreshed.json();
          if (!cancelled && data?.gamification) setGameData(data.gamification);
        } catch (error) {
          console.warn("Reward reconciliation unavailable:", error);
        }
      })();

      try {
        const response = await progressRequest;
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Progress could not be loaded.");
        if (!cancelled) setGameData(data.gamification);
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message || "Progress could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
        finishInitialProgress();
      }
    }
    void loadGameProgress();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const recommendedWorkshops = useMemo(
    () => recommendYouthWorkshops({ workshops, registrations, student }),
    [workshops, registrations, student]
  );
  const upcomingSessions = useMemo(
    () => findJourneyUpcomingSessions(workshops),
    [workshops]
  );
  const registeredWorkshopIds = useMemo(
    () => new Set(registrations.filter(item => item.status === "upcoming").map(item => item.workshopId)),
    [registrations]
  );

  if (authLoading || (user && loading)) {
    return <main className="game-loading"><LoaderCircle className="button-spinner" size={36} /> Loading your journey...</main>;
  }
  if (!user) {
    return <main className="game-loading"><h1>Login Required</h1><Link href="/login">Login</Link></main>;
  }
  if (errorMessage || !gameData) {
    return <main className="game-loading"><h1>Journey unavailable</h1><p>{errorMessage}</p></main>;
  }

  const adventure = adventureJourney(gameData, catalogueStatus === "ready"
    ? recommendYouthWorkshops({ workshops, registrations, student, limit: workshops.length, includeUpcoming: true })
    : null, registrations);

  return (
    <main className={`journey-game-page ${playfulSkin.journeyShell}`}>
      <section className="journey-game-hero">
        <div className="journey-game-glow journey-game-glow-one" />
        <div className="journey-game-glow journey-game-glow-two" />

        <div className="student-content-container">

          <span className="journey-game-label">
            <Sparkles size={15} />
            MY LEARNING JOURNEY
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
                    You&apos;ve reached the highest level!
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



      <div className="student-content-container journey-game-content">
        {rewardStatus && <p role="status" className={playfulSkin.rewardNotice}>{rewardStatus}</p>}

        {/* 1. RECOMMENDED WORKSHOPS */}
        <section className="dashboard-section dashboard-recommendation-section" aria-labelledby="journey-recommended-heading">
          <div className="dashboard-section-heading">
            <div>
              <span>RECOMMENDED FOR YOU</span>
              <h2 id="journey-recommended-heading">Recommended experiences</h2>
            </div>
            <Link href="/workshops">Browse all experiences <ChevronRight size={16} aria-hidden="true" /></Link>
          </div>
          {recommendedWorkshops.length > 0 ? (
            <div className="dashboard-recommendation-grid">
              {recommendedWorkshops.map(workshop => (
                <Link href={`/workshops/${encodeURIComponent(workshop.id)}`}
                  className="dashboard-recommendation-card" key={workshop.id}>
                  <div className="dashboard-recommendation-image">
                    <WorkshopArtwork workshop={workshop} sizes="(max-width: 700px) 100vw, 350px" />
                    {workshop.recommendationScore > 0 && <span><Sparkles size={12} /> MATCHED TO YOU</span>}
                  </div>
                  <div className="dashboard-recommendation-content">
                    <small>{workshop.category || workshop.programArea || "SAIT Youth"}</small>
                    <h3>{workshop.title}</h3>
                    <div><span>Explore experience</span><ChevronRight size={17} /></div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="game-empty-card">
              <Compass size={36} />
              <h3>Discover your next experience</h3>
              <p>Explore the catalogue for opportunities that match your school grade.</p>
              <Link href="/workshops">Explore experiences</Link>
            </div>
          )}
        </section>

        {/* 2. FUTURE PATHWAYS */}
        <section className="quest-section" aria-labelledby="journey-pathways-heading">
          <div className="game-section-heading">
            <div>
              <span>FUTURE PATHWAYS</span>
              <h2 id="journey-pathways-heading">Future pathways (SAIT programs)</h2>
            </div>
            <p>Explore SAIT programs that connect to what you enjoy learning.</p>
          </div>
          {pathways.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              {pathways.slice(0, 3).map(rec => (
                <article key={rec.program.id}
                  className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Sparkles size={12} /> {rec.matchLabel}
                      </span>
                      <GraduationCap size={18} className="text-slate-400" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 line-clamp-2 mb-2">{rec.program.title}</h3>
                    <div className="space-y-1.5 mb-4">
                      {rec.reasons?.map((reason, index) => (
                        <p key={index} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-emerald-500 font-bold mt-0.5">•</span><span>{reason}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                  <a href={rec.program.informationUrl} target="_blank" rel="noopener noreferrer"
                    className={playfulSkin.programLink}>
                    <span>View SAIT Program</span><ExternalLink size={14} />
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="game-empty-card">
              <GraduationCap size={36} />
              <h3>Your future pathways are growing</h3>
              <p>Complete experiences to help discover SAIT programs aligned with your interests.</p>
            </div>
          )}
        </section>

        {/* 3. UPCOMING AT SAIT — nothing rendered when no future sessions */}
        {upcomingSessions.length > 0 && (
          <section className="quest-section" aria-labelledby="journey-upcoming-heading">
            <div className="game-section-heading">
              <div>
                <span>COMING UP</span>
                <h2 id="journey-upcoming-heading">Upcoming at SAIT</h2>
              </div>
              <p>Active experience sessions, starting with the soonest.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              {upcomingSessions.map(workshop => (
                <article key={workshop.id}
                  className="flex flex-col justify-between gap-3 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex gap-1 items-center rounded-xl bg-amber-50 text-amber-800 px-3 py-1 text-xs font-bold">
                        <CalendarDays size={15} aria-hidden="true" />{workshopDateLabel(workshop.daysAway)}
                      </span>
                      <span className="text-xs text-slate-500">{workshop.category || "SAIT Youth"}</span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">{workshop.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {formatWorkshopDate(workshop.startDate)}
                      {workshop.learningMode ? ` · ${workshop.learningMode}` : ""}
                    </p>
                  </div>
                  <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-700 px-4 py-2 font-bold text-sm text-white hover:bg-rose-800"
                    href={`/workshops/${encodeURIComponent(workshop.id)}`}>
                    {registeredWorkshopIds.has(workshop.id) ? "View registered experience" : "View experience & sessions"}
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* 4. ADVENTURE MAP */}
        <AdventureTrail {...adventure} catalogueStatus={catalogueStatus} showBadgeLink={false} />

        {/* 5. BADGES */}
        <section className="journey-achievement-section" aria-labelledby="journey-badges-heading">
          <div className="journey-achievement-icon"><Trophy size={35} /></div>
          <div>
            <span>YOUR ACHIEVEMENTS</span>
            <h2 id="journey-badges-heading">See my badges</h2>
            <p>See the badges you have unlocked and what you can work toward next.</p>
          </div>
          <Link href="/badges">See my badges <ChevronRight size={16} aria-hidden="true" /></Link>
        </section>
      </div>

      <nav className="student-bottom-navigation">
        <Link href="/dashboard"><Home size={20} /><span>Home</span></Link>
        <Link href="/workshops"><BookOpen size={20} /><span>Experiences</span></Link>
        <Link href="/journey" className="active"><Map size={20} /><span>Journey</span></Link>
        <Link href="/badges"><Trophy size={20} /><span>Badges</span></Link>
        <Link href="/profile"><UserRound size={20} /><span>Profile</span></Link>
      </nav>
    </main>
  );
}
