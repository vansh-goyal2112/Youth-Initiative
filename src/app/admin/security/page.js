"use client";
import { useState } from "react";
import { adminFetch } from "@/services/adminApi";
import Image from "next/image";

import { KeyRound, ShieldCheck, LockKeyhole, Smartphone, Copy, CheckCircle2, ArrowRight, ScanLine, ShieldAlert } from "lucide-react";

import QRCode from "qrcode";


export default function AdminSecurityPage() {

  const [secret, setSecret] = useState(null);
  const [qrImage, setQrImage] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function startEnrollment() {
    setLoading(true);setError("");
    try {
      const r=await adminFetch("/api/admin/mfa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"start"})});
      const d=await r.json();if(!r.ok)throw new Error(d.message);
      setSecret({secretKey:d.manualKey});setQrImage(await QRCode.toDataURL(d.uri,{width:220,margin:2}));
    }catch(e){setError(e.message||"Setup failed.");}finally{setLoading(false);}
  }
  async function confirmEnrollment(event){
    event.preventDefault();setLoading(true);setError("");
    try{
      const r=await adminFetch("/api/admin/mfa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"enroll",code})});
      const d=await r.json();if(!r.ok)throw new Error(d.message);
      setSecret(null);setQrImage("");setCode("");setMessage("Authenticator activated. Keep these recovery codes in a secure location: "+(d.recoveryCodes||[]).join(", "));
    }catch(e){setError(e.message||"Verification failed.");}finally{setLoading(false);}
  }
  return <main className="admin-security-redesign mx-auto max-w-5xl px-4 py-8 md:px-8">
    <div className="admin-security-heading"><p className="admin-section-eyebrow"><ShieldCheck size={16}/> ACCOUNT PROTECTION</p>
      <h1>Security, <span>built around you.</span></h1>
      <p>Strengthen your administrator account with a second verification step. Your SAIT identity stays protected.</p>
    </div>
    <div className="admin-security-grid">
      <section className="admin-security-card">
        <div className="admin-team-panel-heading"><span className="admin-panel-icon"><Smartphone size={23}/></span>
          <div><h2>Authenticator verification</h2><p>Time-based one-time password (TOTP)</p></div></div>
        <div className="admin-security-notice"><ShieldAlert size={19}/><p>Application-level authenticator verification protects your admin account without a Firebase paid upgrade.</p></div>
        {error && <div className="admin-auth-alert error" role="alert"><ShieldCheck size={19}/><span>{error}</span></div>}
        {message && <div className="admin-auth-alert success" role="status"><CheckCircle2 size={19}/><span>{message}</span></div>}
        {!secret ? <div className="admin-security-action"><p>Add your account to Microsoft Authenticator, Google Authenticator, or another compatible app.</p>
          <button type="button" disabled={loading} onClick={startEnrollment}><Smartphone size={19}/>{loading ? "Preparing setup…" : "Set up authenticator"}<ArrowRight size={18}/></button></div> :
          <form onSubmit={confirmEnrollment} className="admin-security-enrollment">
            <div className="admin-security-qr"><Image src={qrImage} alt="Scan in your authenticator app" width={220} height={220} unoptimized/><p>Scan this code with your authenticator app.</p>
              <div><code>{secret.secretKey}</code><button type="button" aria-label="Copy authenticator secret" onClick={()=>navigator.clipboard.writeText(secret.secretKey)}><Copy size={17}/></button></div></div>
            <label>Six-digit authenticator code<div className="admin-auth-input-wrap"><KeyRound size={19}/><input value={code} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,"").slice(0,6))} placeholder="000000" required/></div></label>
            <div className="admin-security-buttons"><button disabled={loading} type="submit"><LockKeyhole size={18}/>{loading ? "Verifying…" : "Activate MFA"}</button><button type="button" onClick={()=>{setSecret(null);setQrImage("");setCode("");}}>Cancel</button></div>
          </form>}
      </section>
      <aside className="admin-security-aside">
        <span className="admin-security-aside-icon"><ScanLine size={30}/></span>
        <p className="admin-panel-kicker">WHY IT MATTERS</p>
        <h2>Stronger access. Greater peace of mind.</h2>
        <p>Even if a password is exposed, an authenticator adds another step before someone can access your administrator account.</p>
        <div className="admin-security-benefits">
          <div><CheckCircle2 size={18}/> A separate verification step</div>
          <div><CheckCircle2 size={18}/> Short-lived security codes</div>
          <div><CheckCircle2 size={18}/> Protection for sensitive operations</div>
        </div>
        <div className="admin-security-footnote"><ShieldCheck size={17}/> Never share your verification code or authenticator setup secret.</div>
      </aside>
    </div>
  </main>;
}
