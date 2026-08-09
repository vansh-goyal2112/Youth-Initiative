"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  RefreshCw,
} from "lucide-react";

export default function ConsentPendingPage() {
  const [registration, setRegistration] =
    useState(null);

  useEffect(() => {
    const savedRegistration =
      sessionStorage.getItem(
        "pendingRegistration"
      );

    if (savedRegistration) {
      try {
        setRegistration(
          JSON.parse(savedRegistration)
        );
      } catch {
        setRegistration(null);
      }
    }
  }, []);

  const email =
    registration?.email ||
    "the email address provided";

  const firstName =
    registration?.firstName || "the student";

  return (
    <main className="consent-pending-page">
      <section className="consent-pending-card">
        <Link
          href="/register"
          className="consent-back-link"
        >
          <ArrowLeft size={20} />
          Back
        </Link>

        <Image
          src="/images/landing/sait-logo.jpg"
          alt="Southern Alberta Institute of Technology"
          width={245}
          height={80}
          className="consent-logo"
          priority
        />

        <div className="consent-mail-icon">
          <Mail size={37} />
        </div>

        <h1>Parent / Guardian Consent</h1>

        <p className="consent-introduction">
          Since {firstName} is under 18, we need
          consent from a parent or guardian.
        </p>

        <p className="consent-email-label">
          We sent a parental verification link to:
        </p>

        <strong className="consent-email">
          {email}
        </strong>

        <Link
          href="/register"
          className="change-email-link"
        >
          Change Email
        </Link>

        <div className="consent-information-box">
          <CheckCircle2 size={25} />

          <p>
            An email has been sent with
            instructions to approve {firstName}
            &apos;s account. The link expires in
            30 minutes.
          </p>
        </div>

        <div className="consent-pending-actions">
          <Link
            href="/login"
            className="consent-login-button"
          >
            Return to Login
          </Link>

          <p>
            Check your inbox and spam folder before
            requesting another email.
          </p>
        </div>
      </section>
    </main>
  );
}