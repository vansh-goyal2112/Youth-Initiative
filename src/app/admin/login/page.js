"use client";

import {
  useState,
  useRef,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  ArrowRight,
  Mail,
  CheckCircle2,
  Sparkles,
  KeyRound,
  UserRoundPlus,
} from "lucide-react";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  signOut,
} from "firebase/auth";

import {
  auth,
} from "@/services/firebase";

import {
  adminFetch,
} from "@/services/adminApi";
import { appCheckFetch } from "@/services/appCheckApi";

function readableAuthError(error, fallback) {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "An account already exists with this SAIT email. Select Request access, then resend verification if needed.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect. Check your details or reset your password.";
    case "auth/too-many-requests":
      return "Too many verification or sign-in attempts. Please wait before trying again.";
    case "auth/network-request-failed":
      return "Could not connect to Firebase. Check your connection and try again.";
    case "auth/unauthorized-domain":
      return "This website is not authorized for Firebase email verification. Contact the Youth Initiatives team.";
    default:
      return error?.message || fallback;
  }
}

export default function AdminLoginPage() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [mode, setMode] = useState("login");
  const [resending, setResending] = useState(false);
  const mfaResolverRef = useRef(null);
  const [totpCode, setTotpCode] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  async function resendVerification() {
    setResending(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      if (!auth.currentUser || auth.currentUser.email?.toLowerCase() !== email.trim().toLowerCase()) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      const response = await adminFetch("/api/admin/auth/send-verification", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "The verification request could not be completed.");
      }
      setInfoMessage(data.verified
        ? data.message
        : `${data.message} ${data.deliveryId ? `Azure reference for SAIT IT: ${data.deliveryId}.` : ""} If the email does not arrive, check Inbox/Junk and ask SAIT IT to check its mailbox message trace.`);
      if (data.verified) setMode("request");
    } catch (error) { setErrorMessage(readableAuthError(error, "Could not resend verification.")); }
    finally { setResending(false); }
  }

  async function handleLogin(
    event
  ) {
    event.preventDefault();

    try {
      setInfoMessage("");
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      /*
        Step 1:
        Authenticate the administrator
        through Firebase Authentication.
      */

      if (!/^[^@\s]+@(?:edu\.)?sait\.ca$/i.test(email.trim())) {
        throw new Error("Use a SAIT email ending in @sait.ca or @edu.sait.ca.");
      }
      if (mode === "reset") {
        // Admin passwords are recovered via Firebase-authorized one-time
        // links, delivered with the same Azure sender as admin verification.
        // No existing sign-in is necessary. This is a consumed App Check token.
        const response = await appCheckFetch("/api/admin/password-reset/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        }, { limitedUse: true });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Could not start administrator password recovery.");
        }
        setInfoMessage(data.message);
        return;
      }
      if (mode === "register") {
        if (password.length < 12 || !/[A-Z]/.test(password) ||
            !/[a-z]/.test(password) || !/[0-9]/.test(password) ||
            !/[^A-Za-z0-9]/.test(password)) {
          throw new Error("Use at least 12 characters including uppercase, lowercase, a number and a symbol.");
        }
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        const response = await adminFetch("/api/admin/auth/send-verification", { method: "POST" });
        const data = await response.json();
        if (!response.ok) {
          // The Firebase account was created successfully. Do not ask the
          // applicant to create it again when only the email dispatch failed.
          setMode("request");
          throw new Error(`${data.message || "Could not request verification."} Your account exists; choose Resend via Azure Email.`);
        }
        setInfoMessage(`${data.message} ${data.deliveryId ? `Azure reference for SAIT IT: ${data.deliveryId}.` : ""} If the message does not arrive, check Inbox/Junk or ask SAIT IT to check mailbox delivery.`);
        setMode("request");
        return;
      }
      if (mode === "appMfa") {
        const otpResponse = await adminFetch("/api/admin/mfa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"verify",code:totpCode})});
        const otpData = await otpResponse.json();
        if (!otpResponse.ok) throw new Error(otpData.message || "Incorrect authenticator code.");
        setTotpCode("");
      } else if (mode === "mfa") {
        const resolver = mfaResolverRef.current;
        const hint = resolver?.hints?.find((entry) =>
          entry.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (!hint || !/^\d{6}$/.test(totpCode)) {
          throw new Error("Enter the six-digit code from your authenticator.");
        }
        await resolver.resolveSignIn(
          TotpMultiFactorGenerator.assertionForSignIn(hint.uid, totpCode)
        );
        mfaResolverRef.current = null;
        setTotpCode("");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      if (mode === "request") {
        // Like the student verification flow, confirm the verification state
        // before advancing. Firebase tokens can contain stale email_verified
        // claims until a fresh token is obtained after clicking the link.
        const applicant = auth.currentUser;
        await applicant.reload();
        if (!applicant.emailVerified) {
          throw new Error("Your SAIT email is not verified yet. Open the verification link from your inbox, then return here. If no email arrived, use Resend via Azure Email below.");
        }
        await applicant.getIdToken(true);
        const response = await adminFetch("/api/admin/access-request", { method: "POST" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to request access.");
        setInfoMessage(data.message || "Pending Super Admin approval.");
        return;
      }

      /*
        Step 2:
        Verify that the authenticated
        Firebase user is also an active
        administrator in Firestore.

        adminFetch automatically sends:
        - Firebase Auth ID token
        - Firebase App Check token

        The previous implementation used
        normal fetch(), so the App Check
        token was missing.
      */

      if (mode === "login" && !auth.currentUser?.emailVerified) {
        setMode("request");
        setInfoMessage("Your email is not verified yet. Use Resend via Azure Email below, then select Request access after clicking the link.");
        return;
      }

      const response =
        await adminFetch(
          "/api/admin/auth/verify",
          {
            method:
              "POST",
          }
        );

      const data =
        await response.json();

      if (response.status === 428) {
        setMode("appMfa");
        return;
      }
      if (
        !response.ok
      ) {
        await signOut(
          auth
        );

        throw new Error(
          data.message ||
            "Administrator authentication could not be verified."
        );
      }

      /*
        Keep the non-sensitive admin
        profile information available
        for the current browser session.
      */

      sessionStorage.setItem(
        "adminSession",
        JSON.stringify(
          data.admin
        )
      );

      /*
        Move into the protected admin
        portal after successful server
        verification.
      */

      router.replace(
        "/admin"
      );
    } catch (
      error
    ) {
      if (error?.code === "auth/multi-factor-auth-required") {
        mfaResolverRef.current = getMultiFactorResolver(auth, error);
        setMode("mfa");
        setErrorMessage("");
        return;
      }
      console.error(
        "Admin login error:",
        error
      );

      setErrorMessage(
        readableAuthError(error, "Administrator sign-in failed.")
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  const content = {
    login: { eyebrow: "WELCOME BACK", title: "Sign in to your workspace", detail: "Manage programs, people and progress in one secure place.", action: "Sign in to dashboard" },
    register: { eyebrow: "JOIN THE TEAM", title: "Create an admin account", detail: "Use @sait.ca or @edu.sait.ca. Email verification and Super Admin approval are required.", action: "Create account" },
    request: { eyebrow: "ACCESS REQUEST", title: "Request administrator access", detail: "Already verified your SAIT email? Send your application for review.", action: "Submit access request" },
    reset: { eyebrow: "ACCOUNT RECOVERY", title: "Reset your password", detail: "We’ll send password recovery instructions to your SAIT email.", action: "Send recovery email" },
    appMfa: { eyebrow: "EXTRA PROTECTION", title: "Verify your authenticator", detail: "Enter the current six-digit code to access the administration workspace.", action: "Verify & continue" },
    mfa: { eyebrow: "EXTRA PROTECTION", title: "Two-step verification", detail: "Enter the six-digit code from your authenticator app.", action: "Verify & continue" },
  }[mode] || {};
  const options = [{ id: "login", text: "Sign in" }, { id: "register", text: "Create account" }, { id: "request", text: "Request access" }];
  return (
    <main className="admin-auth min-h-screen bg-[#f5f6fb]">
      <div className="admin-auth-grid">
        <section className="admin-auth-story" aria-label="Youth Initiatives administration">
          <div className="admin-auth-story-content">
            <div className="admin-auth-brand"><span className="admin-auth-brand-mark">S</span><span><strong>SAIT</strong><small>YOUTH INITIATIVES</small></span></div>
            <div className="admin-auth-story-main">
              <span className="admin-auth-kicker"><Sparkles size={15}/> THE PROGRAM OPERATIONS PLATFORM</span>
              <h2>Make every learning experience <em>count.</em></h2>
              <p>Bring student success, meaningful programs and measurable impact together in one thoughtfully designed workspace.</p>
              <div className="admin-auth-story-highlights">
                <div><CheckCircle2 size={20}/><span>One place for your entire program</span></div>
                <div><CheckCircle2 size={20}/><span>Progress, participation and insights</span></div>
                <div><CheckCircle2 size={20}/><span>Secure, role-based team access</span></div>
              </div>
            </div>
            <div className="admin-auth-story-footer"><span className="admin-auth-story-dot"/> DESIGNED FOR THE PEOPLE BEHIND THE IMPACT <span>© SAIT Youth Initiatives</span></div>
          </div>
          <div className="admin-auth-decoration admin-auth-decoration-one" aria-hidden="true"/>
          <div className="admin-auth-decoration admin-auth-decoration-two" aria-hidden="true"/>
        </section>
        <section className="admin-auth-form-panel">
          <div className="admin-auth-mobile-brand"><span className="admin-auth-brand-mark">S</span><span><strong>SAIT</strong><small>YOUTH INITIATIVES</small></span></div>
          <div className="admin-auth-form-wrap">
            <div className="admin-auth-lock"><ShieldCheck size={23}/></div>
            <span className="admin-auth-eyebrow">{content.eyebrow}</span>
            <h1>{content.title}</h1>
            <p className="admin-auth-intro">{content.detail}</p>
            {mode !== "mfa" && mode !== "appMfa" && mode !== "reset" && <div className="admin-auth-tabs" role="group" aria-label="Account options">
              {options.map(item => <button type="button" key={item.id} aria-pressed={mode === item.id} className={mode === item.id ? "selected" : ""}
                onClick={() => { setMode(item.id); setErrorMessage(""); setInfoMessage(""); }}>{item.text}</button>)}
            </div>}
            <form onSubmit={handleLogin} className="admin-auth-form">
              {mode !== "mfa" && mode !== "appMfa" && <label className="admin-auth-field"><span>SAIT email (@sait.ca or @edu.sait.ca)</span><div className="admin-auth-input-wrap"><Mail size={19}/><input type="email" value={email} required autoComplete="email" placeholder="name@sait.ca" onChange={event => setEmail(event.target.value)}/></div></label>}
              {mode !== "reset" && mode !== "mfa" && mode !== "appMfa" && <label className="admin-auth-field"><span>Password</span><div className="admin-auth-input-wrap"><LockKeyhole size={18}/><input type={showPassword ? "text" : "password"} value={password} required autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="Enter your password" onChange={event => setPassword(event.target.value)}/><button className="admin-auth-visibility" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></label>}
              {mode === "register" && <p className="admin-auth-hint">At least 12 characters, with uppercase, lowercase, a number and a symbol.</p>}
              {(mode === "mfa" || mode === "appMfa") && <label className="admin-auth-field"><span>Authenticator code</span><div className="admin-auth-input-wrap"><KeyRound size={19}/><input type="text" inputMode="text" minLength={6} maxLength={19} autoComplete="one-time-code" value={totpCode} onChange={event => setTotpCode(event.target.value.replace(/[^0-9a-fA-F-]/g, "").slice(0, 19))} placeholder="6-digit code or recovery code" required/></div></label>}
              {infoMessage && <div className="admin-auth-alert success" role="status"><CheckCircle2 size={19}/><span>{infoMessage}</span></div>}
              {errorMessage && <div className="admin-auth-alert error" role="alert"><ShieldCheck size={19}/><span>{errorMessage}</span></div>}
              <button className="admin-auth-submit" type="submit" disabled={loading}>
                {loading
                  ? <><LoaderCircle size={19} className="animate-spin" aria-hidden="true"/><span className="admin-auth-submit-label">Processing...</span></>
                  : <>{mode === "register" ? <UserRoundPlus size={19} aria-hidden="true"/> : <LockKeyhole size={18} aria-hidden="true"/>}<span className="admin-auth-submit-label">{content.action}</span><ArrowRight size={19} aria-hidden="true"/></>}
              </button>
            </form>
            <div className="admin-auth-actions-stack">
              {mode === "reset" && (
              <p className="admin-auth-hint">Recovery instructions are sent through the SAIT Youth Initiatives email service. If nothing arrives, check Inbox/Junk and ask SAIT IT to check message trace. Do not create a second admin account.</p>
            )}
            {mode === "request" && (
              <div className="admin-auth-verification-actions">
                <button
                  type="button"
                  disabled={resending || loading}
                  className="admin-auth-secondary"
                  onClick={resendVerification}
                >
                  {resending ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true"/> : <Mail size={17} aria-hidden="true"/>}
                  <span>Resend via Azure Email</span>
                </button>
                <p className="admin-auth-hint">
                  If your verification email has not arrived, check Inbox/Junk.
                  SAIT IT can also check quarantine and message trace. Do not create another admin account.
                </p>
              </div>
            )}
            {mode === "reset" || mode === "mfa" || mode === "appMfa" ? <button type="button" className="admin-auth-back" onClick={() => {setMode("login");setErrorMessage("");setInfoMessage("");}}>← Back to sign in</button> :
              <button type="button" className="admin-auth-back" onClick={() => {setMode("reset");setErrorMessage("");setInfoMessage("");}}>Forgot your password?</button>}
              <div className="admin-auth-trust"><ShieldCheck size={16} aria-hidden="true"/><span>Protected access · SAIT verified accounts only</span></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
