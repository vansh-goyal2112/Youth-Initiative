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
} from "lucide-react";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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
    try {
      if (!auth.currentUser || auth.currentUser.email?.toLowerCase() !== email.trim().toLowerCase()) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      const response = await adminFetch("/api/admin/auth/send-verification", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not resend verification.");
      setInfoMessage(data.message);
    } catch (error) { setErrorMessage(error?.message || "Could not resend verification."); }
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

      if (!/^[^@\s]+@sait\.ca$/i.test(email.trim())) {
        throw new Error("A SAIT work email is required.");
      }
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setInfoMessage("If this email has an account, a reset message will be sent.");
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
        if (!response.ok) throw new Error(data.message || "Verification email could not be sent.");
        setInfoMessage("A verification link was sent through Azure Email. Open your SAIT inbox, verify, then return to request access.");
        setMode("request");
        return;
      }
      if (mode === "mfa") {
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
        error?.message ||
          "Invalid admin credentials."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-login-icon">
          <ShieldCheck
            size={38}
          />
        </div>

        <span className="admin-login-label">
          SAIT YOUTH INITIATIVE
        </span>

        <h1>{mode === "mfa" ? "Verify Authenticator Code" : mode === "register" ? "Request an Admin Account" : mode === "request" ? "Submit Access Request" : mode === "reset" ? "Reset Password" : "Administrator Login"}</h1>

        <p>
          Sign in with your authorized
          administrator account.
        </p>

        <form
          className="admin-login-form"
          onSubmit={
            handleLogin
          }
        >
          <label>
            Admin Email

            <input
              type="email"
              value={
                email
              }
              required
              autoComplete="email"
              onChange={(
                event
              ) =>
                setEmail(
                  event.target.value
                )
              }
            />
          </label>

          {mode !== "reset" && mode !== "mfa" && <label>
            Password

            <div className="admin-password-input">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={
                  password
                }
                required={mode !== "reset"}
                autoComplete="current-password"
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target.value
                  )
                }
              />

              <button
                type="button"
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                onClick={() =>
                  setShowPassword(
                    (
                      currentValue
                    ) =>
                      !currentValue
                  )
                }
              >
                {showPassword ? (
                  <EyeOff
                    size={20}
                  />
                ) : (
                  <Eye
                    size={20}
                  />
                )}
              </button>
            </div>
          </label>}

          {mode === "mfa" && (
            <label className="block text-sm font-semibold text-slate-700">
              Authenticator code
              <input type="text" inputMode="numeric" pattern="[0-9]{6}"
                minLength={6} maxLength={6} autoComplete="one-time-code"
                value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                placeholder="6-digit code" required />
            </label>
          )}
          {mode === "register" && <p className="mt-2 text-xs text-slate-500">Use at least 12 characters with uppercase, lowercase, a number and a symbol.</p>}

          {infoMessage && <div className="admin-success-message" role="status">{infoMessage}</div>}
          {errorMessage && (
            <div
              className="admin-login-error"
              role="alert"
            >
              {
                errorMessage
              }
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading
            }
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={19}
                  className="button-spinner"
                />

                Processing...
              </>
            ) : (
              <>
                <LockKeyhole
                  size={18}
                />

                {mode === "mfa" ? "Verify & Continue" : mode === "register" ? "Register & Verify Email" : mode === "request" ? "Request Approval" : mode === "reset" ? "Send Reset Email" : "Login to Admin Portal"}
              </>
            )}
          </button>
        </form>
        {(mode === "request" || mode === "register") && (
          <button type="button" disabled={resending} onClick={resendVerification}
            className="mt-4 w-full rounded-xl border border-orange-300 px-4 py-2 text-sm font-semibold text-orange-700 disabled:opacity-50">
            {resending ? "Sending verification..." : "Resend verification email via Azure"}
          </button>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
          {["login","register","request","reset"].map((value) => (
            <button key={value} type="button" onClick={() => {setMode(value);setErrorMessage("");setInfoMessage("");}} className={mode === value ? "font-bold text-orange-600" : "text-slate-600"}>
              {value === "login" ? "Login" : value === "register" ? "New Admin" : value === "request" ? "Request Access" : "Forgot Password"}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}