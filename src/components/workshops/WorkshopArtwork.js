"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen, Plane } from "lucide-react";
import { getWorkshopImage } from "@/utils/getWorkshopImage";
import styles from "./WorkshopArtwork.module.css";

// Workshop images may be local assets or URLs imported from SAIT.
// External images bypass the Next image optimizer so an unconfigured
// remote host cannot produce /_next/image 400 errors in Azure.
function imageSource(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const source = value.trim();
  if (source.startsWith("/") && !source.startsWith("//")) {
    return { src: source, remote: false };
  }

  try {
    const url = new URL(source.startsWith("//") ? `https:${source}` : source);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // An HTTPS deployment cannot display HTTP images (mixed content).
    if (url.protocol === "http:") url.protocol = "https:";
    return { src: url.toString(), remote: true };
  } catch {
    return null;
  }
}

// The same photo/placeholder is used on cards, details and the dashboard.
export default function WorkshopArtwork({
  workshop,
  sizes = "100vw",
  priority = false,
  className,
}) {
  const [failedSrc, setFailedSrc] = useState(null);
  const source = imageSource(getWorkshopImage(workshop));

  if (source && failedSrc !== source.src) {
    return (
      <Image
        src={source.src}
        alt={workshop?.title || "Youth workshop"}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={source.remote}
        className={className}
        onError={() => setFailedSrc(source.src)}
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
