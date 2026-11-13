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
  AlertCircle,
  BookOpen,
  CalendarDays,
  Check,
  GraduationCap,
  Heart,
  Info,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MonitorPlay,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
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
        error instanceof Error && error.message
          ? error.message
          : "Your profile could not be updated."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  const initialInterests = Array.isArray(student.interests) ? student.interests : [];
  const isDirty =
    firstName.trim() !== (student.firstName || "").trim() ||
    lastName.trim() !== (student.lastName || "").trim() ||
    schoolGrade !== (student.schoolGrade || "") ||
    learningMode !== (student.learningMode || "") ||
    JSON.stringify(interests) !== JSON.stringify(initialInterests);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <button type="button" className={styles.back} onClick={() => router.push("/profile")}>
          <ArrowLeft size={18} aria-hidden="true" /> Back to My Profile
        </button>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><Sparkles size={16} aria-hidden="true" /> YOUR SKILL QUEST PASSPORT</span>
            <h1>Edit My Identity</h1>
            <p>Make your learning journey yours. Keep your school details up to date and choose what you love exploring.</p>
          </div>
          <span className={styles.heroIcon} aria-hidden="true"><UserRound size={45} /></span>
        </header>

        <form onSubmit={saveProfile} className={styles.form}>
          <section className={styles.card} aria-labelledby="edit-basics-title">
            <div className={styles.cardHeader}>
              <span className={styles.sectionIcon} aria-hidden="true"><GraduationCap size={23}/></span>
              <div>
                <h2 id="edit-basics-title">A little about you</h2>
                <p>These details help us show workshops suited to your grade.</p>
              </div>
            </div>
            <div className={styles.nameGrid}>
              <div className={styles.field}>
                <label htmlFor="firstName">First name</label>
                <input id="firstName" type="text" autoComplete="given-name" minLength={2} maxLength={40} required value={firstName} onChange={event => setFirstName(event.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="lastName">Last name</label>
                <input id="lastName" type="text" autoComplete="family-name" minLength={2} maxLength={40} required value={lastName} onChange={event => setLastName(event.target.value)} />
              </div>
            </div>
            <div className={[styles.field, styles.gradeField].join(" ")}>
              <label htmlFor="schoolGrade">Current school grade</label>
              <select id="schoolGrade" required value={schoolGrade} onChange={event => setSchoolGrade(event.target.value)}>
                <option value="">Choose your grade</option>
                <option value="K">Kindergarten</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={String(index + 1)}>Grade {index + 1}</option>
                ))}
              </select>
              <p className={styles.fieldHint}>Your grade helps us find age-appropriate workshops.</p>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="edit-learning-title">
            <div className={styles.cardHeader}>
              <span className={[styles.sectionIcon, styles.iconMint].join(" ")} aria-hidden="true"><MonitorPlay size={23}/></span>
              <div>
                <h2 id="edit-learning-title">How do you like to learn?</h2>
                <p>Pick your preferred workshop format. You can change this anytime.</p>
              </div>
            </div>
            <div className={styles.choiceGrid} role="group" aria-label="Learning preference">
              {[
                ["in-person", "In person"],
                ["online", "Online"],
                ["both", "I like both"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={[styles.choice, learningMode === value && styles.selected].filter(Boolean).join(" ")}
                  aria-pressed={learningMode === value}
                  onClick={() => setLearningMode(value)}
                >
                  {learningMode === value ? <Check size={18} aria-hidden="true"/> : <BookOpen size={18} aria-hidden="true"/>}
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.card} aria-labelledby="edit-interests-title">
            <div className={styles.cardHeader}>
              <span className={[styles.sectionIcon, styles.iconGold].join(" ")} aria-hidden="true"><Heart size={23}/></span>
              <div>
                <h2 id="edit-interests-title">What sparks your curiosity?</h2>
                <p>Choose up to five interests to personalize your recommendations.</p>
              </div>
            </div>
            <div className={styles.interestHeading}>
              <span className={styles.fieldLabel}>My interests</span>
              <span className={styles.counter} aria-live="polite">{interests.length} of 5 selected</span>
            </div>
            <div className={styles.interestGrid} role="group" aria-label="Student interests">
              {availableInterests.map(interest => {
                const selected = interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    className={[styles.interest, selected && styles.selected].filter(Boolean).join(" ")}
                    aria-pressed={selected}
                    disabled={!selected && interests.length >= 5}
                    onClick={() => toggleInterest(interest)}
                  >
                    {selected && <Check size={15} aria-hidden="true"/>}
                    {formatInterest(interest)}
                  </button>
                );
              })}
            </div>
            <p className={styles.interestHelp}><Info size={15} aria-hidden="true"/> You can unselect an interest to make room for a new one.</p>
          </section>

          <section className={styles.card} aria-labelledby="edit-private-title">
            <div className={styles.cardHeader}>
              <span className={[styles.sectionIcon, styles.iconGrey].join(" ")} aria-hidden="true"><ShieldCheck size={23}/></span>
              <div>
                <h2 id="edit-private-title">Your account details</h2>
                <p>These details are protected and cannot be changed here.</p>
              </div>
            </div>
            <div className={styles.privateGrid}>
              <div className={styles.privateItem}>
                <span><Mail size={15} aria-hidden="true"/> Email address <LockKeyhole size={13} aria-label="Locked"/></span>
                <strong>{studentContactEmail(student) || user.email || "Not available"}</strong>
              </div>
              <div className={styles.privateItem}>
                <span><CalendarDays size={15} aria-hidden="true"/> Date of birth <LockKeyhole size={13} aria-label="Locked"/></span>
                <strong>{formatStudentBirthDate(student.dateOfBirth) || "Not available"}</strong>
              </div>
            </div>
            <p className={styles.privateNote}><LockKeyhole size={16} aria-hidden="true"/> Contact SAIT Youth Initiatives staff if your protected account details need correcting.</p>
          </section>

          {errorMessage && <div className={styles.error} role="alert"><AlertCircle size={19} aria-hidden="true"/>{errorMessage}</div>}
          <div className={styles.actionBar}>
            <p className={styles.actionNote}>{isDirty ? "You have unsaved changes." : "Everything is up to date."}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} disabled={saving} onClick={() => router.push("/profile")}>Cancel</button>
              <button type="submit" className={styles.save} disabled={saving || !isDirty}>
                {saving ? <><LoaderCircle size={18} className="button-spinner" aria-hidden="true"/> Saving…</> : <><Save size={18} aria-hidden="true"/> Save changes</>}
              </button>
            </div>
          </div>
        </form>
      </div>
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