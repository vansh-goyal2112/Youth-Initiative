"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ArrowLeft,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [youthId, setYouthId] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      if (!youthId.trim()) {
        setErrorMessage(
          "Youth Initiative ID is required."
        );

        return;
      }

      setLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          "/api/password-reset/request",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              youthId:
                youthId.trim(),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message
        );
      }

      sessionStorage.setItem(
        "passwordResetRequest",
        JSON.stringify({
          requestId:
            data.requestId,
          youthId:
            youthId
              .trim()
              .toUpperCase(),
        })
      );

      router.push(
        "/reset-request-sent"
      );
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Password reset could not be started."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="password-flow-page">

      <section className="password-flow-card">

        <Link
          href="/login"
          className="password-flow-back"
        >
          <ArrowLeft size={18} />
          Back to Login
        </Link>

        <div className="password-flow-icon">
          <LockKeyhole size={35} />
        </div>

        <span className="password-flow-label">
          ACCOUNT RECOVERY
        </span>

        <h1>
          Forgot your password?
        </h1>

        <p>
          Enter your Youth Initiative ID.
          We&apos;ll send a verification link
          to the registered parent or guardian
          email.
        </p>


        <div className="password-security-note">
          <ShieldCheck size={20} />

          <span>
            Parent or guardian verification
            is required before your password
            can be changed.
          </span>
        </div>


        <form
          onSubmit={handleSubmit}
          className="password-flow-form"
        >

          <label>
            Youth Initiative ID

            <input
              type="text"
              value={youthId}
              maxLength={20}
              autoComplete="username"
              placeholder="Enter your Youth ID"
              onChange={(event) =>
                setYouthId(
                  event.target.value
                    .replace(
                      /\s/g,
                      ""
                    )
                    .toUpperCase()
                )
              }
            />
          </label>


          {errorMessage && (
            <div className="password-flow-error">
              {errorMessage}
            </div>
          )}


          <button
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={19}
                  className="button-spinner"
                />

                Sending...
              </>
            ) : (
              <>
                <Mail size={18} />
                Send Verification Email
              </>
            )}
          </button>

        </form>

      </section>

    </main>
  );
}