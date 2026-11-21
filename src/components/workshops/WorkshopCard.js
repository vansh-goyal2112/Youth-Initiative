import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  BookOpen,
  Users,
} from "lucide-react";

import WorkshopArtwork from "@/components/workshops/WorkshopArtwork";
import { getWorkshopSchedule, workshopDateRange } from "@/utils/workshopDate.mjs";
import { getConfiguredWorkshopXp } from "@/utils/workshopXpDisplay.mjs";

export default function WorkshopCard({ workshop }) {
  const dateLabel = workshopDateRange(getWorkshopSchedule(workshop));
  const xpReward = getConfiguredWorkshopXp(workshop);

  const eligibilityLabel =
    workshop.grade ||
    (Number.isInteger(workshop.minAge) ||
    Number.isInteger(workshop.maxAge)
      ? `Ages ${workshop.minAge ?? "?"} - ${workshop.maxAge ?? "up"}`
      : "Eligibility not listed");

  return (
    <article className="student-workshop-card">
      <div className="student-workshop-image-wrapper">
        <WorkshopArtwork workshop={workshop} sizes="(max-width: 700px) 100vw, 340px" className="student-workshop-image" />

      </div>

      <div className="student-workshop-content">
        <span className="workshop-category-label">
          {workshop.category || workshop.programArea}
        </span>

        <h2>{workshop.title}</h2>

        {workshop.availabilityStatus === "closed" && (
          <span className="workshop-availability-status">
            Registration closed
          </span>
        )}

        <p className="workshop-card-description">
          {workshop.description ||
            "Explore this SAIT Youth Initiatives learning opportunity."}
        </p>

        <div className="workshop-card-details">
          <div>
            <Users size={16} />
            {eligibilityLabel}
          </div>

          {dateLabel && <div>
            <CalendarDays size={16} />
            {dateLabel}
          </div>}
        </div>

        {workshop.eligibilityStatus === "unconfirmed" && (
          <p className="workshop-eligibility-notice">
            Eligibility needs confirmation.{" "}
            {workshop.grade && !workshop.minAge && !workshop.maxAge
              ? "Add your grade to your profile to check grade-based eligibility."
              : "Check the official SAIT page before registering."}
          </p>
        )}

        <div className="workshop-card-footer">
          <span className="workshop-card-reward">
            {xpReward === null ? <strong>XP not set</strong> : <>Earn <strong>{xpReward} XP</strong></>}
            <small className="workshop-program-area"><BookOpen size={13} aria-hidden="true" /> {workshop.programArea || "Program area not listed"}</small>
          </span>

          <Link href={`/workshops/${workshop.id}`}>
            View Details
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}