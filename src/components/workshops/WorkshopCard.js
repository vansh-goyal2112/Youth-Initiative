import Image from "next/image";
import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Monitor,
  Users,
} from "lucide-react";

import { getWorkshopImage } from "@/utils/getWorkshopImage";

export default function WorkshopCard({ workshop }) {
  const workshopImage =
    workshop.image ||
    getWorkshopImage(workshop.category);

  const learningMode =
    workshop.learningMode === "online"
      ? "Online"
      : workshop.learningMode === "both"
        ? "Online & In Person"
        : workshop.learningMode === "in-person"
          ? "In Person"
          : "Format not listed";

  const eligibilityLabel =
    workshop.grade ||
    (Number.isInteger(workshop.minAge) ||
    Number.isInteger(workshop.maxAge)
      ? `Ages ${workshop.minAge ?? "?"} - ${workshop.maxAge ?? "up"}`
      : "Eligibility not listed");

  return (
    <article className="student-workshop-card">
      <div className="student-workshop-image-wrapper">
        <Image
          src={workshopImage}
          alt={workshop.title}
          fill
          sizes="(max-width: 700px) 100vw, 340px"
          className="student-workshop-image"
        />

        <span className="workshop-mode-badge">
          {workshop.learningMode === "online" ? (
            <Monitor size={13} />
          ) : workshop.learningMode === "in-person" ? (
            <MapPin size={13} />
          ) : (
            <CalendarDays size={13} />
          )}

          {learningMode}
        </span>
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
          <span>
            Earn <strong>{workshop.xpReward || 100} XP</strong>
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