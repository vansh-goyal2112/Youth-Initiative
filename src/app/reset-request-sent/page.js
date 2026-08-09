import Link from "next/link";

import {
  CheckCircle2,
  Mail,
} from "lucide-react";

export default function ResetRequestSentPage() {
  return (
    <main className="password-flow-page">

      <section className="password-flow-card password-sent-card">

        <div className="password-email-icon">
          <Mail size={36} />
        </div>

        <CheckCircle2
          size={25}
          className="password-small-check"
        />

        <span className="password-flow-label">
          EMAIL SENT
        </span>

        <h1>
          Check your email
        </h1>

        <p>
          We sent a secure parent or guardian
          verification link to the email
          associated with the student account.
        </p>


        <div className="password-security-note">
          The verification link expires in
          30 minutes.
        </div>


        <Link
          href="/login"
          className="password-login-link"
        >
          Return to Login
        </Link>

      </section>

    </main>
  );
}