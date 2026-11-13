"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  getToken as getAppCheckToken,
} from "firebase/app-check";

import {
  ArrowLeft,
  Check,
  LoaderCircle,
} from "lucide-react";

import {
  appCheck,
} from "@/services/firebase";

import {
  useAuth,
} from "@/contexts/AuthContext";

const availableInterests = [
  "coding",
  "artificial intelligence",
  "robotics",
  "skilled trades",
  "business",
  "design",
  "health",
  "aviation",
  "culinary",
];

export default function EditProfilePage() {
  const router =
    useRouter();

  const {
    user,
    studentProfile,
    updateStudentProfile,
    loading,
  } =
    useAuth();

  if (loading) {
    return (
      <main className="profile-state">
        Loading...
      </main>
    );
  }

  if (
    !user ||
    !studentProfile
  ) {
    return (
      <main className="profile-state">
        Profile unavailable.
      </main>
    );
  }

  return (
    <EditProfileForm
      user={user}
      student={
        studentProfile
      }
      updateStudentProfile={updateStudentProfile}
      router={router}
    />
  );
}

function EditProfileForm({
  user,
  student,
  updateStudentProfile,
  router,
}) {
  const [firstName, setFirstName] = useState(student.firstName || "");
  const [lastName, setLastName] = useState(student.lastName || "");

  const [
    schoolGrade,
    setSchoolGrade,
  ] = useState(
    student.schoolGrade ||
      ""
  );

  const [
    learningMode,
    setLearningMode,
  ] = useState(
    student.learningMode ||
      ""
  );

  const [
    interests,
    setInterests,
  ] = useState(
    Array.isArray(
      student.interests
    )
      ? student.interests
      : []
  );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  function toggleInterest(
    interest
  ) {
    setInterests(
      (current) => {
        if (
          current.includes(
            interest
          )
        ) {
          return current.filter(
            (item) =>
              item !==
              interest
          );
        }

        if (
          current.length >=
          5
        ) {
          return current;
        }

        return [
          ...current,
          interest,
        ];
      }
    );
  }

  async function saveProfile(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);

      setErrorMessage(
        ""
      );

      if (!firstName.trim() || !lastName.trim()) {
        throw new Error("Please enter your first and last name.");
      }
      if (!schoolGrade) {
        throw new Error("Please select your current school grade.");
      }

      if (
        !appCheck
      ) {
        throw new Error(
          "App verification is unavailable."
        );
      }

      const [
        idToken,
        appCheckTokenResult,
      ] =
        await Promise.all([
          user.getIdToken(),

          getAppCheckToken(
            appCheck,
            true
          ),
        ]);

      const response =
        await fetch(
          "/api/student/profile",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,

              "X-Firebase-AppCheck":
                appCheckTokenResult.token,
            },

            body:
              JSON.stringify({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                schoolGrade,
                learningMode,
                interests,
              }),
          }
        );

      const result =
        await response
          .json()
          .catch(
            () => null
          );

      if (
        !response.ok ||
        result?.success !==
          true
      ) {
        throw new Error(
          result?.message ||
          "Your profile could not be updated."
        );
      }

      updateStudentProfile(result.student);
      router.push(
        "/profile"
      );
    } catch (error) {
      console.error(
        "Update profile error:",
        error
      );

      setErrorMessage(
        "Your profile could not be updated."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  return (
    <main className="edit-profile-page">
      <section className="edit-profile-card">
        <button
          type="button"
          className="edit-profile-back"
          onClick={() =>
            router.back()
          }
        >
          <ArrowLeft
            size={19}
          />

          Back
        </button>

        <span className="edit-profile-label">
          PROFILE SETTINGS
        </span>

        <h1>
          Edit Preferences
        </h1>

        <p>
          Update how you prefer
          to learn and the areas
          you want to explore.
        </p>

        <form
          onSubmit={
            saveProfile
          }
          className="edit-profile-form"
        >
          <div className="edit-identity-name-grid">
            <div className="edit-profile-field">
              <label htmlFor="firstName">First Name</label>
              <input id="firstName" className="edit-profile-text-input" autoComplete="given-name" maxLength={40} required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div className="edit-profile-field">
              <label htmlFor="lastName">Last Name</label>
              <input id="lastName" className="edit-profile-text-input" autoComplete="family-name" maxLength={40} required value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
          </div>

          <div className="edit-profile-field">
            <label htmlFor="schoolGrade">
              Current School Grade
            </label>

            <select
              id="schoolGrade"
              required
              value={schoolGrade}
              onChange={(event) =>
                setSchoolGrade(event.target.value)
              }
            >
              <option value="">Select your grade</option>
              <option value="K">Kindergarten</option>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={String(index + 1)}>
                  Grade {index + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="edit-profile-field">
            <label>
              Learning Preference
            </label>

            <div className="edit-learning-grid">
              {[
                [
                  "in-person",
                  "In Person",
                ],
                [
                  "online",
                  "Online",
                ],
                [
                  "both",
                  "Both",
                ],
              ].map(
                ([
                  value,
                  label,
                ]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      learningMode ===
                      value
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setLearningMode(
                        value
                      )
                    }
                  >
                    {learningMode ===
                      value && (
                      <Check
                        size={14}
                      />
                    )}

                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="edit-profile-field">
            <div className="edit-interest-heading">
              <label>
                Interests
              </label>

              <span>
                {
                  interests.length
                }{" "}
                / 5
              </span>
            </div>

            <div className="edit-interest-grid">
              {availableInterests.map(
                (
                  interest
                ) => {
                  const selected =
                    interests.includes(
                      interest
                    );

                  return (
                    <button
                      key={
                        interest
                      }
                      type="button"
                      className={
                        selected
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        toggleInterest(
                          interest
                        )
                      }
                    >
                      {selected && (
                        <Check
                          size={13}
                        />
                      )}

                      {formatInterest(
                        interest
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="onboarding-error">
              {
                errorMessage
              }
            </div>
          )}

          <button
            type="submit"
            className="edit-profile-save"
            disabled={
              saving
            }
          >
            {saving ? (
              <>
                <LoaderCircle
                  size={18}
                  className="button-spinner"
                />

                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </form>
      </section>
    </main>
  );
}

function formatInterest(
  interest
) {
  return interest
    .split(" ")
    .map(
      (word) =>
        word
          .charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}