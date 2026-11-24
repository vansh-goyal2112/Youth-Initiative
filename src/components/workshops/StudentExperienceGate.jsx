"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function StudentExperienceGate({ children, statusClass, loginMessage }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <main className={statusClass} role="status">Loading your student session…</main>;
  }

  if (!user) {
    return (
      <main className={statusClass}>
        <h1>Login Required</h1>
        <p>{loginMessage}</p>
        <Link href="/login">Go to Login</Link>
      </main>
    );
  }

  return <Fragment key={user.uid}>{children}</Fragment>;
}
