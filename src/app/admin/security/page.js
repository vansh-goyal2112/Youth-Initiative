"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, LockKeyhole, Smartphone, Copy } from "lucide-react";
import {
  multiFactor, TotpMultiFactorGenerator, signOut,
} from "firebase/auth";
import QRCode from "qrcode";
import { auth } from "@/services/firebase";

export default function AdminSecurityPage() {
  const router = useRouter();
  const [secret, setSecret] = useState(null);
  const [qrImage, setQrImage] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function startEnrollment() {
    setLoading(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user?.emailVerified) throw new Error("Sign in with a verified SAIT email first.");
      const session = await multiFactor(user).getSession();
      const generated = await TotpMultiFactorGenerator.generateSecret(session);
      const uri = generated.generateQrCodeUrl(user.email, "SAIT Youth Initiative Admin");
      const image = await QRCode.toDataURL(uri, { width: 220, margin: 2 });
      setSecret(generated);
      setQrImage(image);
    } catch (err) {
      setError(err.message || "Authenticator setup is unavailable. Firebase Identity Platform MFA must be enabled first.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnrollment(event) {
    event.preventDefault();
    if (!secret) return;
    setLoading(true);
    setError("");
    try {
      if (!/^\d{6}$/.test(code)) throw new Error("Enter the current six-digit authenticator code.");
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
      await multiFactor(auth.currentUser).enroll(assertion, "SAIT Admin Authenticator");
      setSecret(null);
      setQrImage("");
      setCode("");
      setMessage("Authenticator enrollment succeeded. Sign in again to verify your second factor.");
      await signOut(auth);
      router.replace("/admin/login");
    } catch (err) {
      setError(err.message || "Authenticator verification failed.");
    } finally {
      setLoading(false);
    }
  }
  return <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
    <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Account Protection</p>
    <h1 className="mt-2 text-3xl font-bold text-slate-900">Administrator Security</h1>
    <p className="mt-3 text-slate-600">Protect your account with an authenticator app such as Microsoft Authenticator or Google Authenticator.</p>
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-orange-50 p-3 text-orange-600"><ShieldCheck size={25}/></span><div><h2 className="text-lg font-bold text-slate-900">Authenticator verification</h2><p className="text-xs text-slate-500">Time-based one-time password (TOTP)</p></div></div>
      <p className="mt-5 text-sm leading-6 text-slate-600">Setup requires Firebase Authentication with Identity Platform and TOTP MFA enabled for your project. Do not enable an admin-only MFA requirement until employees have enrolled.</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
      {!secret ? <button onClick={startEnrollment} disabled={loading} type="button" className="mt-6 flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white disabled:opacity-50"><Smartphone size={19}/>{loading ? "Preparing setup..." : "Set up authenticator"}</button> :
        <form onSubmit={confirmEnrollment} className="mt-6 space-y-5">
          <div className="flex flex-col items-center rounded-2xl bg-slate-50 p-6">
            <img src={qrImage} width="220" height="220" alt="Scan this QR code in your authenticator application" className="rounded-xl border border-slate-200 bg-white p-2"/>
            <p className="mt-3 text-sm text-slate-600">Scan in your authenticator app, or copy the secret below.</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <code className="break-all rounded-lg bg-white px-3 py-2 text-xs text-slate-900">{secret.secretKey}</code>
              <button className="rounded-lg border border-slate-300 p-2 text-slate-700" type="button" aria-label="Copy authenticator secret" onClick={()=>navigator.clipboard.writeText(secret.secretKey)}><Copy size={17}/></button>
            </div>
          </div>
          <label className="block text-sm font-semibold text-slate-700"><span className="flex items-center gap-2"><KeyRound size={17}/> Current six-digit code</span><input className="mt-2 w-full rounded-xl border border-slate-300 p-3" value={code} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} onChange={(e)=>setCode(e.target.value.replace(/[^0-9]/g,"").slice(0,6))} required /></label>
          <div className="flex flex-wrap gap-3"><button disabled={loading} type="submit" className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white disabled:opacity-50"><LockKeyhole size={17}/>{loading ? "Verifying..." : "Activate MFA"}</button><button type="button" className="rounded-xl border border-slate-300 px-5 py-3 text-slate-700" onClick={()=>{setSecret(null);setQrImage("");setCode("");}}>Cancel</button></div>
        </form>}
    </section>
  </main>;
}
