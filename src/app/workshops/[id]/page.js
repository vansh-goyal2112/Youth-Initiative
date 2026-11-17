"use client";

import Link from "next/link";
import ctaStyles from "@/components/workshops/previouslyCompletedCta.module.css";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  BookOpen,
  CalendarDays,
  Clock,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Monitor,
  Star,
  Users,
} from "lucide-react";

import WorkshopArtwork from "@/components/workshops/WorkshopArtwork";
import { getWorkshopSchedule, workshopDateRange } from "@/utils/workshopDate.mjs";

import {
  studentFetch,
} from "@/services/studentApi";

export default function WorkshopDetailsPage() {
  const params = useParams();

  const [workshop, setWorkshop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadWorkshop() {
      try {
        const response = await studentFetch(
          `/api/workshops/${encodeURIComponent(params.id)}`
        );

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.message);
        }

        setWorkshop(responseData.workshop);
      } catch (error) {
        setErrorMessage(
          error.message ||
            "Workshop details could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadWorkshop();
    }
  }, [params.id]);

  if (loading) {
    return (
      <main className="workshop-details-status">
        <LoaderCircle
          size={38}
          className="button-spinner"
        />
        <p>Loading workshop...</p>
      </main>
    );
  }

  if (errorMessage || !workshop) {
    return (
      <main className="workshop-details-status">
        <BookOpen size={48} />

        <h1>Workshop unavailable</h1>
        <p>{errorMessage}</p>


      </main>
    );
  }

  const registrationUrl = workshop.registrationUrl || "https://saitdigitalyouth.campbrainregistration.com/";
  const activeSessions = Array.isArray(workshop.sessions)
    ? workshop.sessions.filter(session => session.status === "active")
    : [];
  const schedule = getWorkshopSchedule(workshop);
  const dateLabel = workshopDateRange(schedule);

  return (
    <main className="workshop-details-page">
      <div className="student-content-container workshop-details-layout">
        <section className="workshop-details-main">
          <div className="workshop-details-image-wrapper">
            <WorkshopArtwork workshop={workshop} sizes="(max-width: 900px) 100vw, 65vw" className="workshop-details-image" priority />

            <span className="workshop-details-mode">
              {workshop.learningMode === "online" ? (
                <Monitor size={16} />
              ) : workshop.learningMode === "in-person" ? (
                <MapPin size={16} />
              ) : (
                <CalendarDays size={16} />
              )}

              {workshop.learningMode === "online"
                ? "Online"
                : workshop.learningMode === "both"
                  ? "Online & In Person"
                  : workshop.learningMode === "in-person"
                    ? "In Person"
                    : "Format not listed"}
            </span>
          </div>

          <div className="workshop-details-content">
            <span className="workshop-category-label">
              {workshop.category ||
                workshop.programArea}
            </span>

            <h1>{workshop.title}</h1>
            {dateLabel && <p className="text-sm font-semibold text-slate-700">
              <CalendarDays size={16} aria-hidden="true" className="mr-2 inline" />{dateLabel}
            </p>}

            <p className="workshop-details-description">
              {workshop.description}
            </p>

            {workshop.availabilityStatus === "closed" && (
              <div className="workshop-availability-notice" role="status">
                <strong>Registration closed</strong>
                <p>
                  Registration is closed for now. Check SAIT for new dates.
                </p>
              </div>
            )}

            {workshop.eligibilityStatus === "unconfirmed" && (
              <div className="workshop-eligibility-notice" role="status">
                <strong>Eligibility not confirmed</strong>
                <p>
                  {workshop.eligibilityMessage} Add your current grade to
                  your profile if this workshop lists a grade requirement,
                  and check the official SAIT page before registering.
                </p>
              </div>
            )}

            <div className="workshop-information-grid">
              <InformationItem
                icon={Users}
                label="Grade"
                value={
                  workshop.grade ||
                  (Number.isInteger(workshop.minAge) ||
                  Number.isInteger(workshop.maxAge)
                    ? `Ages ${workshop.minAge ?? "?"} - ${workshop.maxAge ?? "up"}`
                    : "Eligibility not listed")
                }
              />

              {dateLabel && <InformationItem icon={CalendarDays} label="Date" value={dateLabel} />}
              {schedule.time && <InformationItem icon={Clock} label="Time" value={schedule.time} />}

              <InformationItem
                icon={MapPin}
                label="Location"
                value={
                  workshop.location ||
                  (workshop.learningMode === "online" ? "Online" : "Not listed")
                }
              />
            </div>

            {workshop.informationUrl && (
              <a
                href={workshop.informationUrl}
                target="_blank"
                rel="noreferrer"
                className="official-workshop-link"
              >
                View Official Workshop Information
                <ExternalLink size={17} />
              </a>
            )}
          </div>
        </section>

        <aside className="workshop-registration-card">
          <div className="workshop-xp-card">
            <Star size={25} />

            <div>
              <span>Workshop Reward</span>
              <strong>
                +{workshop.xpReward ?? 100} XP
              </strong>
            </div>
          </div>

          {activeSessions.length > 0 ? (
            <>
              <h2>Choose your session</h2>
              <p>Pick a date that works for you. Register on the SAIT website.</p>
              <div className="space-y-3">
                {activeSessions.map(session => (
                  <article key={session.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-1 text-sm font-extrabold text-slate-900">{workshopDateRange(session)}</h3>
                    <p className="mb-3 text-xs text-slate-600">{[session.time,session.location,session.capacity != null ? "Capacity " + session.capacity : ""].filter(Boolean).join(" · ")}</p>
                    <div className="flex flex-wrap gap-2">
                      <a href={session.registrationUrl || registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-rose-800">Register <ExternalLink size={15}/></a>
                      <Link href={`/registration-success/${workshop.id}?sessionId=${encodeURIComponent(session.id)}`} className="inline-flex min-h-10 items-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-extrabold text-rose-800 hover:bg-rose-50">I completed registration</Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : workshop.availabilityStatus === "closed" ? (
            <>
              <h2>Registration unavailable</h2>
              <p>
                SAIT currently lists this workshop&apos;s sessions as closed.
              </p>
              <a
                href={workshop.informationUrl}
                target="_blank"
                rel="noreferrer"
                className="official-workshop-link"
              >
                Check SAIT for future dates
                <ExternalLink size={17} />
              </a>
            </>
          ) : (
            <>
              <h2>Ready to register?</h2>

              <p>
                Register on the SAIT website. Then come back here.
              </p>

              <a
                href={registrationUrl}
                target="_blank"
                rel="noreferrer"
                className="workshop-register-button"
              >
                Register Now
                <ExternalLink size={18} />
              </a>

              <Link
                href={`/registration-success/${workshop.id}`}
                className="registration-confirmation-link"
              >
                I completed registration
              </Link>

              <div className="workshop-registration-note">
                Registered on SAIT? Confirm it here.
              </div>
            </>
          )}
          <div className="mt-6 border-t border-slate-200 pt-5">
            <h2 className="mb-2 text-base font-extrabold text-slate-900">Already attended this workshop?</h2>
            <p className="mb-3 text-sm leading-relaxed text-slate-600">
              Attended before? Claim half XP. SAIT staff may review your claim.
            </p>
            <Link
              href={`/completed-workshops?workshop=${encodeURIComponent(workshop.id)}#previously-completed`}
              className={`${ctaStyles.button} ${ctaStyles.fullWidth}`}
            >
              <CalendarDays size={18} aria-hidden="true" />
              Previously Completed
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

function InformationItem({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="workshop-information-item">
      <span>
        <Icon size={20} />
      </span>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}