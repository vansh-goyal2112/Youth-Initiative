import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  BookOpen,
  Users,
} from "lucide-react";

import WorkshopArtwork from "@/components/workshops/WorkshopArtwork";

export default function WorkshopCard({ workshop }) {

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
            "Explore this SAIT Youth Initiative learning opportunity."}
        </p>

        <div className="workshop-card-details">
          <div>
            <Users size={16} />
            {eligibilityLabel}
          </div>

          <div>
            <CalendarDays size={16} />
            {workshop.startDate || "Date to be announced"}
          </div>
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
            Earn <strong>{workshop.xpReward ?? 100} XP</strong>
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