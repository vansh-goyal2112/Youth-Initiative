"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Mail,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { appCheckFetch } from "@/services/appCheckApi";
import styles from "./resumeRegistration.module.css";

export default function ResumeRegistrationPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function requestRecovery(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await appCheckFetch("/api/register/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message || "We couldn't process the request right now. Please try again."
        );
      }

      setSubmitted(true);
    } catch (error) {
      setError(error?.message || "We couldn't process the request right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.formPanel}>
          <header className={styles.topNav}>
            <Link href="/register" className={styles.back} aria-label="Return to registration">
              <ArrowLeft size={20} aria-hidden="true"/>
              Back
            </Link>
            <Link href="/" aria-label="SAIT Youth Initiative home">
              <Image
                src="/images/landing/sait-logo.jpg"
                alt="SAIT"
                width={128}
                height={52}
                className={styles.logo}
              />
            </Link>
          </header>

          {submitted ? (
            <div className={styles.mainCopy} role="status">
              <div className={styles.successIcon}><CheckCircle2 size={40} aria-hidden="true"/></div>
              <span className={styles.eyebrow}>RECOVERY REQUEST RECEIVED</span>
              <h1>Check your inbox!</h1>
              <p>
                If there is an unfinished registration for that email, a new secure link will be
                sent to the email already connected to the registration.
              </p>
              <div className={styles.note}>
                <Mail size={21} aria-hidden="true"/>
                <span>For a student under 18, the next link goes to the original parent or guardian email.</span>
              </div>
              <p className={styles.smallHelp}>
                Look in your spam or junk folder too. Links expire after 30 minutes, but
                you can request another one later.
              </p>
              <button type="button" className={styles.primary} onClick={() => {setSubmitted(false);setError("");}}>
                <RefreshCcw size={18} aria-hidden="true"/>
                Try Another Email
              </button>
              <Link href="/login" className={styles.secondary}>Return to Login <ArrowRight size={17} aria-hidden="true"/></Link>
              <p className={styles.smallHelp}>
                Nothing arrives? The old registration may already be closed.
                You can <Link href="/register">start a new registration</Link>, or contact
                <a href="mailto:youth.programs@sait.ca"> Youth Initiative support</a>
                if you no longer have access to the original email.
              </p>
            </div>
          ) : (
            <div className={styles.mainCopy}>
              <div className={styles.iconCircle}><RefreshCcw size={31} aria-hidden="true"/></div>
              <span className={styles.eyebrow}>SAIT YOUTH INITIATIVE</span>
              <h1>Continue Your Adventure</h1>
              <p>
                Started signing up but didn&apos;t finish? You don&apos;t have to begin from scratch.
                We&apos;ll help you securely pick up where you left off.
              </p>

              <form onSubmit={requestRecovery} className={styles.form}>
                <label htmlFor="recovery-email">Email you used during registration</label>
                <div className={styles.inputWrap}>
                  <Mail size={19} aria-hidden="true"/>
                  <input
                    id="recovery-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={submitting}
                  />
                </div>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <button type="submit" className={styles.primary} disabled={submitting || !email.trim()}>
                  {submitting ? "Checking securely..." : "Send Recovery Link"}
                  {!submitting && <ArrowRight size={18} aria-hidden="true"/>}
                </button>
              </form>

              <div className={styles.note}>
                <ShieldCheck size={22} aria-hidden="true"/>
                <span>We send recovery instructions only to the original verified student email or parent/guardian email. This does not skip parental consent.</span>
              </div>
              <p className={styles.smallHelp}>
                Already finished registration? <Link href="/login">Log in here</Link>.
                Need a fresh start? <Link href="/register">Go to Registration</Link>.
              </p>
            </div>
          )}
        </section>

        <aside className={styles.funPanel}>
          <span className={styles.bubbleOne} aria-hidden="true"/>
          <span className={styles.bubbleTwo} aria-hidden="true"/>
          <span className={styles.funStarOne} aria-hidden="true">✦</span>
          <span className={styles.funStarTwo} aria-hidden="true">✳</span>
          <div className={styles.funContent}>
            <span className={styles.funTag}><Sparkles size={17} aria-hidden="true"/> SKILL QUEST</span>
            <h2>Your story is still waiting for you.</h2>
            <p>No missed adventure should stop you from exploring what comes next.</p>
            <div className={styles.steps}>
              <div><span><Mail size={21} aria-hidden="true"/></span><strong>Enter your email</strong><small>Use your original signup address</small></div>
              <div><span><LockKeyhole size={21} aria-hidden="true"/></span><strong>Open the secure link</strong><small>Sent to the trusted contact on record</small></div>
              <div><span><Clock3 size={21} aria-hidden="true"/></span><strong>Continue your setup</strong><small>Verify, receive consent or finish your account</small></div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
