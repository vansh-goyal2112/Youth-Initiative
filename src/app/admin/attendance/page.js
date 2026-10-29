"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { LoaderCircle, QrCode, CalendarCheck2, Timer, ShieldCheck, CheckCircle2, ArrowRight, BookOpen, ScanLine, RefreshCw, Clock3 } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

export default function AdminAttendancePage() {
  const [workshops, setWorkshops] = useState([]);
  const [workshopId, setWorkshopId] = useState("");
  const [duration, setDuration] = useState(15);
  const [qrImage, setQrImage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingWorkshops, setLoadingWorkshops] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let alive = true;
    adminFetch("/api/admin/workshops")
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load workshops.");
        if (alive) setWorkshops(Array.isArray(data.workshops) ? data.workshops : []);
      })
      .catch(error => { if (alive) setErrorMessage(error.message || "Could not load workshops."); })
      .finally(() => { if (alive) setLoadingWorkshops(false); });
    return () => { alive = false; };
  }, []);

  async function generateQr() {
    if (!workshopId) { setErrorMessage("Choose a workshop to create an attendance session."); return; }
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      setQrImage("");
      setExpiresAt("");
      const response = await adminFetch("/api/admin/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workshopId, durationMinutes: Number(duration) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to create attendance session.");
      const qrPayload = JSON.stringify({ attendanceSessionId: data.attendanceSessionId, code: data.code });
      const image = await QRCode.toDataURL(qrPayload, { width: 440, margin: 2, color: { dark: "#15233d", light: "#ffffff" } });
      setQrImage(image);
      setExpiresAt(data.expiresAt);
      setSuccessMessage("Your attendance session is ready. Display this QR to students.");
    } catch (error) {
      setErrorMessage(error.message || "QR code could not be generated.");
    } finally { setLoading(false); }
  }

  const workshop = workshops.find(item => item.id === workshopId);
  return <main className="admin-attendance-page admin-attendance-redesign">
    <div className="admin-attendance-intro">
      <span className="admin-section-eyebrow"><ScanLine size={15}/> ENGAGEMENT OPERATIONS</span>
      <h1>Attendance <span>studio.</span></h1>
      <p>Create a secure, time-limited check-in for your next workshop. One scan connects the experience to a student’s learning journey.</p>
    </div>
    <div className="admin-attendance-grid">
      <section className="admin-attendance-settings" aria-label="Attendance session settings">
        <div className="admin-panel-top">
          <span className="admin-panel-icon"><CalendarCheck2 size={22}/></span>
          <div><span className="admin-panel-kicker">STEP 01</span><h2>Set up check-in</h2></div>
        </div>
        <p className="admin-panel-subtext">Choose the experience and how long students can scan the code.</p>
        <div className="admin-attendance-fields">
          <label><span><BookOpen size={16}/> Workshop</span>
            <select disabled={loadingWorkshops || loading} value={workshopId} onChange={event => {setWorkshopId(event.target.value);setSuccessMessage("");setQrImage("");}}>
              <option value="">{loadingWorkshops ? "Loading workshops…" : "Choose a workshop"}</option>
              {workshops.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label><span><Timer size={16}/> Check-in window</span>
            <select value={duration} disabled={loading} onChange={event => {setDuration(event.target.value);setQrImage("");setSuccessMessage("");}}>
              {[5,10,15,30].map(minutes => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
            </select>
          </label>
        </div>
        {workshop && <div className="admin-attendance-workshop"><CheckCircle2 size={18}/><span>Selected: <strong>{workshop.title}</strong></span></div>}
        {errorMessage && <div className="admin-auth-alert error mt-5" role="alert"><ShieldCheck size={19}/><span>{errorMessage}</span></div>}
        <button type="button" disabled={loading || !workshopId} className="admin-attendance-generate" onClick={generateQr}>
          {loading ? <><LoaderCircle size={19} className="animate-spin"/> Creating session…</> : <><QrCode size={19}/> {qrImage ? "Create new session" : "Generate check-in QR"} <ArrowRight size={19}/></>}
        </button>
        <div className="admin-attendance-info"><ShieldCheck size={18}/><p>Only authorized administrators can generate a session. Codes expire automatically after the selected window.</p></div>
      </section>
      <section className="admin-attendance-preview" aria-label="Attendance QR preview">
        <div className="admin-panel-top">
          <span className="admin-panel-icon violet"><QrCode size={22}/></span>
          <div><span className="admin-panel-kicker">STEP 02</span><h2>Student scan view</h2></div>
        </div>
        <div className={`admin-attendance-preview-body ${qrImage ? "has-qr" : ""}`}>
          {qrImage ? <>
            <div className="admin-attendance-qr-frame"><Image src={qrImage} width={440} height={440} alt="QR code for current workshop attendance session" unoptimized/></div>
            <div className="admin-attendance-active-badge"><span/> Check-in session created</div>
            {workshop && <p className="admin-attendance-session-title">{workshop.title}</p>}
            {expiresAt && <div className="admin-attendance-expiry"><Clock3 size={17}/> Code expires at <strong>{new Date(expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong></div>}
            {successMessage && <p className="admin-attendance-confirmation" role="status">{successMessage}</p>}
          </> : <>
            <div className="admin-attendance-placeholder"><ScanLine size={64}/></div>
            <h3>Your QR will appear here</h3>
            <p>Select a workshop and generate a code to begin attendance. Show the code on a screen so students can scan it.</p>
            <span><RefreshCw size={15}/> Dynamic, temporary check-in</span>
          </>}
        </div>
      </section>
    </div>
  </main>;
}
