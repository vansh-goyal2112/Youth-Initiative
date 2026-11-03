import Image from "next/image";
import { BookOpen, Plane } from "lucide-react";
import { getWorkshopImage } from "@/utils/getWorkshopImage";
import styles from "./WorkshopArtwork.module.css";

// The same photo/placeholder is used on cards, details and the dashboard.
export default function WorkshopArtwork({
  workshop,
  sizes = "100vw",
  priority = false,
  className,
}) {
  const image = getWorkshopImage(workshop);
  if (image) {
    return (
      <Image
        src={image}
        alt={workshop?.title || "Youth workshop"}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
      />
    );
  }

  const aviation = /aviation|aircraft|pilot/i.test(
    `${workshop?.title || ""} ${workshop?.category || ""}`
  );

  return (
    <div
      className={styles.placeholder}
      role="img"
      aria-label={`Photo coming soon for ${workshop?.title || "this workshop"}`}
    >
      <div className={styles.decoration} aria-hidden="true" />
      <div className={styles.icon} aria-hidden="true">
        {aviation ? <Plane size={32} strokeWidth={1.7} /> : <BookOpen size={32} strokeWidth={1.7} />}
      </div>
      <span className={styles.eyebrow}>SAIT YOUTH INITIATIVE</span>
      <strong className={styles.heading}>{aviation ? "Explore Aviation" : "Explore New Skills"}</strong>
      <span className={styles.caption}>Workshop photo coming soon</span>
    </div>
  );
}
