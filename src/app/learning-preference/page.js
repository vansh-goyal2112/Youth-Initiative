"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";

import {
  Building2,
  Check,
  LoaderCircle,
  Monitor,
  Shuffle,
} from "lucide-react";

import { db } from "@/services/firebase";
import { useAuth } from "@/contexts/AuthContext";

const preferences = [
  {
    id: "in-person",
    title: "In Person",
    description:
      "Learn on campus through hands-on workshops and activities.",
    icon: Building2,
  },
  {
    id: "online",
    title: "Online",
    description:
      "Join learning experiences from anywhere.",
    icon: Monitor,
  },
  {
    id: "both",
    title: "Both",
    description:
      "Show me both in-person and online opportunities.",
    icon: Shuffle,
  },
];

export default function LearningPreferencePage() {
  const router = useRouter();

  const {
    user,
    student,
    loading: authLoading,
  } = useAuth();

  const [selected, setSelected] = useState(
    student?.learningMode || ""
  );

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function savePreference() {
    try {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (!selected) {
        setErrorMessage(
          "Please select a learning preference."
        );
        return;
      }

      setSaving(true);
      setErrorMessage("");

      await updateDoc(
        doc(db, "students", user.uid),
        {
          learningMode: selected,
        }
      );

      router.push("/interests");
    } catch (error) {
      console.error(
        "Save learning preference error:",
        error
      );

      setErrorMessage(
        "Your preference could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  function skipPreference() {
    router.push("/interests");
  }

  if (authLoading) {
    return (
      <main className="onboarding-status">
        <LoaderCircle
          className="button-spinner"
          size={36}
        />
      </main>
    );
  }

  return (
    <main className="onboarding-page">

      <section className="onboarding-card">

        <div className="onboarding-progress">
          <div className="active" />
          <div />
        </div>

        <span className="onboarding-step">
          STEP 1 OF 2
        </span>

        <h1>
          How do you like to learn?
        </h1>

        <p className="onboarding-description">
          Choose your preferred learning mode.
          You can change this anytime from
          your profile.
        </p>

        <div className="preference-grid">

          {preferences.map((preference) => {
            const Icon =
              preference.icon;

            const active =
              selected ===
              preference.id;

            return (
              <button
                key={preference.id}
                type="button"
                className={`preference-card ${
                  active
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setSelected(
                    preference.id
                  )
                }
              >

                <div className="preference-icon">
                  <Icon size={27} />
                </div>

                <div className="preference-card-copy">
                  <h2>
                    {preference.title}
                  </h2>

                  <p>
                    {
                      preference.description
                    }
                  </p>
                </div>

                <div className="preference-check">
                  {active && (
                    <Check size={15} />
                  )}
                </div>

              </button>
            );
          })}

        </div>

        {errorMessage && (
          <div className="onboarding-error">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          className="onboarding-primary-button"
          disabled={saving}
          onClick={savePreference}
        >
          {saving ? (
            <>
              <LoaderCircle
                size={19}
                className="button-spinner"
              />

              Saving...
            </>
          ) : (
            "Continue"
          )}
        </button>

        <button
          type="button"
          className="onboarding-skip"
          onClick={skipPreference}
        >
          Skip for now
        </button>

      </section>

    </main>
  );
}