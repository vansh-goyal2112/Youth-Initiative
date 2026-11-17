"use client";

import Image from "next/image";
import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import {
  studentFetch,
} from "@/services/studentApi";

export default function RegistrationSuccessPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const {
    user,
    loading:
      authLoading,
  } = useAuth();

  const [
    workshop,
    setWorkshop,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  useEffect(() => {
    if (
      authLoading
    ) {
      return;
    }

    if (!user) {
      router.replace(
        "/login"
      );

      return;
    }

    if (!params.id) {
      return;
    }

    let cancelled =
      false;

    async function loadWorkshop() {
      try {
        setErrorMessage("");

        const response =
          await studentFetch(
            `/api/workshops/${encodeURIComponent(
              params.id
            )}`
          );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            responseData.message ||
              "Workshop could not be loaded."
          );
        }

        if (
          !cancelled
        ) {
          setWorkshop(
            responseData.workshop
          );
        }
      } catch (error) {
        if (
          !cancelled
        ) {
          setErrorMessage(
            error.message ||
              "Workshop could not be loaded."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    loadWorkshop();

    return () => {
      cancelled =
        true;
    };
  }, [
    params.id,
    user,
    authLoading,
    router,
  ]);

  // Read URL search parameters after mount to keep server and client HTML aligned.
  const [requestedSessionId, setRequestedSessionId] = useState(null);
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    setRequestedSessionId(new URL(window.location.href).searchParams.get("sessionId"));
    setUrlReady(true);
  }, []);
  const managedSessions = Array.isArray(workshop?.sessions) && workshop.sessions.length > 0;
  const activeSelectedSession = managedSessions
    ? workshop.sessions.find(item => item.id === requestedSessionId && item.status === "active")
    : null;
  const registrationUnavailable = Boolean(workshop && (
    workshop.availabilityStatus === "closed" ||
    (urlReady && managedSessions && !activeSelectedSession) ||
    (urlReady && !managedSessions && requestedSessionId && requestedSessionId !== "legacy")
  ));

  async function confirmRegistration() {
    try {
      if (!user) {
        router.push(
          "/login"
        );

        return;
      }

      if (!urlReady || registrationUnavailable) {
        setErrorMessage("This session is no longer available. Choose an active session on the workshop page.");
        return;
      }
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response =
        await studentFetch(
          "/api/registrations",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                workshopId: params.id,
                sessionId: typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("sessionId") : null,
              }),
          }
        );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            "Registration could not be confirmed."
        );
      }

      setSuccessMessage(
        responseData.message
      );

      setTimeout(() => {
        router.push(
          "/registered-workshops"
        );
      }, 1200);
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Registration could not be confirmed."
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    authLoading ||
    (
      user &&
      loading
    )
  ) {
    return (
      <main className="registration-confirm-page">
        <section className="registration-confirm-card">
          <LoaderCircle
            className="button-spinner"
            size={38}
          />

          <p>
            Loading registration...
          </p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="registration-confirm-page">
        <section className="registration-confirm-card">
          <LoaderCircle
            className="button-spinner"
            size={38}
          />

          <p>
            Redirecting to login...
          </p>
        </section>
      </main>
    );
  }

  if (!workshop) {
    return (
      <main className="registration-confirm-page">
        <section className="registration-confirm-card">
          <TriangleAlert
            size={48}
          />

          <h1>
            Workshop unavailable
          </h1>

          <p>
            {errorMessage}
          </p>


        </section>
      </main>
    );
  }

  return (
    <main className="registration-confirm-page">
      <section className="registration-confirm-card">
        <Image
          src="/images/landing/sait-logo.jpg"
          alt="SAIT"
          width={220}
          height={70}
          className="registration-confirm-logo"
        />

        <div className="registration-check-icon">
          <CheckCircle2
            size={45}
          />
        </div>

        <span className="registration-confirm-label">
          Registration
          Confirmation
        </span>

        <h1>
          Did you complete your
          registration?
        </h1>

        <p>
          Confirm that you
          completed the official
          SAIT registration process
          for:
        </p>

        <div className="registration-workshop-summary">
          <span>
            {workshop.category ||
              workshop.programArea}
          </span>

          <strong>
            {workshop.title}
          </strong>

          <small>
            {workshop.grade}
            {" · "}
            {workshop.learningMode ===
            "online"
              ? "Online"
              : "In Person"}
          </small>
        </div>

        {errorMessage && (
          <div className="registration-confirm-error">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="registration-confirm-success">
            <CheckCircle2
              size={19}
            />

            {successMessage}
          </div>
        )}

        {registrationUnavailable && (
          <p className="registration-confirm-error" role="alert">
            This workshop session is not available. Go back to workshop details and choose an active session.
          </p>
        )}
        <button
          type="button"
          className="registration-confirm-button"
          disabled={
            !urlReady ||
            registrationUnavailable ||
            saving ||
            Boolean(
              successMessage
            )
          }
          onClick={
            confirmRegistration
          }
        >
          {saving ? (
            <>
              <LoaderCircle
                size={20}
                className="button-spinner"
              />

              Saving Registration...
            </>
          ) : (
            "Yes, I Completed Registration"
          )}
        </button>

        <a
          href={
            activeSelectedSession?.registrationUrl || workshop.registrationUrl ||
            "https://saitdigitalyouth.campbrainregistration.com/"
          }
          target="_blank"
          rel="noreferrer"
          className="registration-portal-link"
        >
          Return to Official
          Registration

          <ExternalLink
            size={17}
          />
        </a>

        <p className="registration-confirm-note">
          Register on the official SAIT website first.
          Then confirm your registration here.
        </p>
      </section>
    </main>
  );
}