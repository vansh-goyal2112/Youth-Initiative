"use client";

import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

export default function ConsentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const registrationId = params.registrationId;
  const token = searchParams.get("token");

  const [registration, setRegistration] = useState(null);
  const [pageStatus, setPageStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function verifyConsentLink() {
      try {
        if (!registrationId || !token) {
          throw new Error("The consent link is incomplete.");
        }

        const response = await fetch(
          "/api/consent/verify",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              registrationId,
              token,
            }),
          }
        );

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(
            responseData.message ||
              "The consent link is invalid."
          );
        }

        setRegistration(responseData.registration);
        setPageStatus("ready");
      } catch (error) {
        setErrorMessage(error.message);
        setPageStatus("error");
      }
    }

    verifyConsentLink();
  }, [registrationId, token]);

  const handleProvideConsent = () => {
    sessionStorage.setItem(
      "approvedConsent",
      JSON.stringify({
        registrationId,
        token,
        firstName: registration.firstName,
      })
    );

    router.push(
      `/set-password/${registrationId}?token=${encodeURIComponent(
        token
      )}`
    );
  };

  if (pageStatus === "loading") {
    return (
      <main className="consent-action-page">
        <div className="consent-action-card consent-status-card">
          <LoaderCircle className="button-spinner" size={38} />
          <h1>Verifying consent link</h1>
          <p>Please wait while we check this request.</p>
        </div>
      </main>
    );
  }

  if (pageStatus === "error") {
    return (
      <main className="consent-action-page">
        <div className="consent-action-card consent-status-card">
          <TriangleAlert size={48} className="consent-error-icon" />

          <h1>Link unavailable</h1>

          <p>{errorMessage}</p>

          <button
            type="button"
            className="consent-primary-button"
            onClick={() => router.push("/register")}
          >
            Return to Registration
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="consent-action-page">
      <section className="consent-action-card">
        <Image
          src="/images/landing/sait-logo.jpg"
          alt="Southern Alberta Institute of Technology"
          width={250}
          height={80}
          className="consent-action-logo"
          priority
        />

        <div className="consent-shield-icon">
          <ShieldCheck size={38} />
        </div>

        <span className="consent-page-label">
          Parent / Guardian
        </span>

        <h1>Parental Consent Request</h1>

        <p className="consent-action-introduction">
          <strong>
            {registration.firstName} {registration.lastName}
          </strong>{" "}
          has requested access to the SAIT Youth Initiative
          student platform.
        </p>

        <div className="consent-review-box">
          <h2>Please confirm that you:</h2>

          <div>
            <CheckCircle2 size={20} />
            Are the student&apos;s parent or legal guardian
          </div>

          <div>
            <CheckCircle2 size={20} />
            Approve the creation of this student account
          </div>

          <div>
            <CheckCircle2 size={20} />
            Will create and manage the initial password
          </div>
        </div>

        <button
          type="button"
          className="consent-primary-button"
          onClick={handleProvideConsent}
        >
          Provide Consent and Set Password
        </button>

        <p className="consent-prototype-note">
          This is a simulated parental-consent process for the
          MVP prototype.
        </p>
      </section>
    </main>
  );
}