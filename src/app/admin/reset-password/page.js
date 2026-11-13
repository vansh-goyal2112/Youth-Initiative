"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { confirmPasswordReset, signOut, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/services/firebase";
import { isValidAdminRecoveryPassword } from "@/services/adminPasswordRecovery.mjs";

export default function AdminResetPasswordPage() {
  const [status, setStatus] = useState("checking");
  const [code, setCode] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const currentCode = new URLSearchParams(window.location.search).get("oobCode");
    if (!currentCode || currentCode.length > 4096) {
      queueMicrotask(() => { if (live) setStatus("invalid"); });
      return () => { live = false; };
    }
    verifyPasswordResetCode(auth, currentCode)
      .then(email => {
        if (!live) return;
        if (!/^[^@\s]+@(?:edu\.)?sait\.ca$/i.test(email)) {
          setStatus("invalid");
          return;
        }
        setAccountEmail(email);
        setCode(currentCode);
        setStatus("ready");
      })
      .catch(() => { if (live) setStatus("invalid"); });
    return () => { live = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (status !== "ready" || !code) return;
    if (!isValidAdminRecoveryPassword(password)) {
      setError("Use 12–64 characters with uppercase, lowercase, a number and a symbol.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setStatus("saving");
    try {
      // Firebase validates and consumes the single-use recovery code.
      // No privileged backend operation or administrator approval is bypassed.
      await confirmPasswordReset(auth, code, password);
      await fetch("/api/admin/mfa/logout", { method: "POST" }).catch(() => {});
      await signOut(auth).catch(() => {});
      window.sessionStorage.removeItem("adminSession");
      window.history.replaceState(null, "", "/admin/reset-password");
      setCode("");
      setPassword("");
      setConfirmPassword("");
      setStatus("success");
    } catch (cause) {
      setError(
        cause?.code === "auth/expired-action-code" || cause?.code === "auth/invalid-action-code"
          ? "This reset link is expired or was already used. Request another email from the admin sign-in page."
          : "The password could not be changed. Check the new password or request a fresh reset link."
      );
      setStatus(cause?.code === "auth/expired-action-code" || cause?.code === "auth/invalid-action-code"
        ? "invalid" : "ready");
    }
  }

  return (
    <main className="admin-auth min-h-screen bg-[#f8f9fc] px-4 py-14">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-700"><LockKeyhole size={25}/></span>
          <div><p className="text-[11px] font-black uppercase tracking-widest text-red-600">SAIT Youth Initiatives</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Reset admin password</h1></div>
        </div>

        {status === "checking" && <p className="flex items-center gap-2 text-sm text-slate-700" role="status">
          <LoaderCircle size={18} className="animate-spin"/> Verifying your secure reset link…
        </p>}

        {status === "invalid" && <div className="space-y-4">
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
            The reset link is invalid, expired or has already been used. Please request another email.
          </p>
          <Link href="/admin/login" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800">Return to admin sign in</Link>
        </div>}

        {(status === "ready" || status === "saving") && (
          <form onSubmit={submit} className="space-y-5">
            <p className="text-sm leading-6 text-slate-600">
              Your email has been verified for password recovery: <strong className="break-all">{accountEmail}</strong>.
              Choose a new password. Admin approval and authenticator requirements remain unchanged.
            </p>
            <label className="block text-sm font-bold text-slate-800">
              New password
              <span className="mt-2 flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-red-500">
                <KeyRound size={18} className="shrink-0 text-slate-500"/>
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={event => setPassword(event.target.value)} minLength={12} maxLength={64}
                  autoComplete="new-password" required disabled={status === "saving"}
                  className="min-w-0 flex-1 p-2 text-slate-900 outline-none" />
                <button type="button" onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"} className="p-2 text-slate-600">
                  {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </span>
            </label>
            <label className="block text-sm font-bold text-slate-800">
              Confirm new password
              <input type="password" value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                minLength={12} maxLength={64} autoComplete="new-password"
                disabled={status === "saving"} required
                className="mt-2 block min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus:border-red-500" />
            </label>
            <p className="text-xs leading-5 text-slate-600">Use 12–64 characters with uppercase and lowercase letters, a number and a symbol.</p>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <button type="submit" disabled={status === "saving"}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 font-bold text-white hover:bg-red-800 disabled:opacity-60">
              {status === "saving" ? <><LoaderCircle size={18} className="animate-spin"/> Updating…</> : "Save new password"}
            </button>
          </form>
        )}

        {status === "success" && <div className="space-y-5">
          <p role="status" className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">
            <CheckCircle2 size={21} className="shrink-0"/> Your password was changed successfully.
          </p>
          <p className="text-sm leading-6 text-slate-600">
            Sign in again with your SAIT email and new password. Your existing MFA setup and role permissions still apply.
          </p>
          <Link href="/admin/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-700 px-5 font-bold text-white">Return to admin sign in</Link>
        </div>}
        <p className="mt-8 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
          <ShieldCheck size={17}/> Never share a password or reset link with another person.
        </p>
      </div>
    </main>
  );
}
