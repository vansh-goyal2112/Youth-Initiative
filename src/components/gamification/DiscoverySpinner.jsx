"use client";

import Link from "next/link";
import { ArrowRight, Compass, Gift, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { chooseDiscovery, getDiscoverableWorkshops } from "@/utils/discoverySpin.mjs";
import styles from "./discoverySpinner.module.css";

/**
 * A small, optional interaction that reveals real catalogued workshops.
 * No rewards or registration changes occur from spinning.
 */
export default function DiscoverySpinner({ workshops = [], registrations = [] }) {
  const choices = useMemo(
    () => getDiscoverableWorkshops(workshops, registrations),
    [workshops, registrations]
  );
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [spins, setSpins] = useState(0);

  function spin() {
    if (!choices.length) return;
    setSelectedWorkshop((current) => chooseDiscovery(choices, current?.id));
    setSpins((count) => count + 1);
  }

  if (choices.length === 0) return null;

  const revealed = selectedWorkshop &&
    choices.find((workshop) => workshop.id === selectedWorkshop.id);

  return (
    <section className={styles.section} aria-labelledby="surprise-workshop-heading">
      <div className={styles.sparkleOne} aria-hidden="true">✦</div>
      <div className={styles.sparkleTwo} aria-hidden="true">✳</div>

      <div className={styles.heading}>
        <span className={styles.label}><Gift size={18} aria-hidden="true"/> DISCOVERY CORNER</span>
        <h2 id="surprise-workshop-heading">Can&apos;t decide what to explore?</h2>
        <p>Try a little surprise! Spin the compass to discover a real workshop you haven&apos;t added to your journey yet.</p>

        <button type="button" className={styles.spinButton} onClick={spin}>
          <Sparkles size={19} aria-hidden="true"/>
          {revealed ? "Spin Again" : "Surprise Me!"}
          <ArrowRight size={18} aria-hidden="true"/>
        </button>
      </div>

      <div className={styles.gameArea}>
        <div
          className={styles.compass}
          aria-hidden="true"
          style={{ transform: `rotate(${spins * 765}deg)` }}
        >
          <Compass size={74} strokeWidth={1.6}/>
        </div>
        {revealed ? (
          <div className={styles.reveal} role="status">
            <span>YOUR SURPRISE ADVENTURE</span>
            <h3>{revealed.title}</h3>
            <p>{revealed.category || revealed.programArea || "Explore something new at SAIT"}</p>
            <Link href={`/workshops/${encodeURIComponent(revealed.id)}`}>
              Explore This Workshop <ArrowRight size={17} aria-hidden="true"/>
            </Link>
          </div>
        ) : (
          <div className={styles.emptyReveal}>
            <strong>Ready to find your next adventure?</strong>
            <span>Give the compass a spin!</span>
          </div>
        )}
      </div>
    </section>
  );
}
