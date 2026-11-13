"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, CheckCircle2, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { studentFetch } from "@/services/studentApi";
import styles from "./selfReportWorkshop.module.css";

export default function SelfReportWorkshop({ onClaimed }) {
  const [workshops, setWorkshops] = useState([]);
  const [selected, setSelected] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [completedOn, setCompletedOn] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    studentFetch("/api/workshops/self-report")
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load past workshops.");
        if (active) setWorkshops(Array.isArray(result.workshops) ? result.workshops : []);
      })
      .catch(cause => { if (active) setError(cause.message || "Past workshops unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const workshop = workshops.find(item => item.id === selected);
  const halfXp = workshop?.xpReward ?? 0;

  async function submit(event) {
    event.preventDefault();
    if (submitting || !selected || !completedOn || !confirmed) return;
    setSubmitting(true); setMessage(""); setError("");
    try {
      const response = await studentFetch("/api/workshops/self-report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workshopId: selected, sessionId: sessionId || null, completedOn, attested: confirmed }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Could not save your completion.");
      setMessage(result.message);
      setWorkshops(current => current.filter(item => item.id !== selected));
      setSelected(""); setSessionId(""); setCompletedOn(""); setConfirmed(false);
      if (typeof onClaimed === "function") onClaimed();
    } catch (cause) {
      setError(cause.message || "Could not save your completion. Please try again.");
    } finally { setSubmitting(false); }
  }

  return (
    <section className={styles.box} aria-labelledby="self-report-title">
      <div className={styles.intro}>
        <span className={styles.icon}><CalendarCheck2 size={25} aria-hidden="true" /></span>
        <div>
          <p className={styles.eyebrow}>ALREADY ATTENDED A WORKSHOP?</p>
          <h2 id="self-report-title">Add it to your Learning Journey.</h2>
          <p>Attended a SAIT workshop before joining the app? Record it here—no QR code needed.</p>
        </div>
        <button type="button" className={styles.toggle} onClick={() => setExpanded(open => !open)} aria-expanded={expanded} aria-controls="claim-workshop-form">
          {expanded ? "Close" : "Mark completed"}
        </button>
      </div>
      {expanded && (
        <div id="claim-workshop-form" className={styles.panel}>
          <div className={styles.explainer}><Sparkles size={18} aria-hidden="true"/>
            Self-reported workshops earn <strong>half the regular XP</strong> immediately and remain subject to admin review.
          </div>
          {loading ? <p className={styles.status}><LoaderCircle size={17} aria-hidden="true"/> Loading workshops…</p> :
          workshops.length === 0 ? <p className={styles.status}>You&apos;ve already recorded all currently available workshop choices.</p> :
          <form onSubmit={submit} className={styles.form}>
            <label className={styles.field}>Workshop
              <select required value={selected} onChange={event => {setSelected(event.target.value);setSessionId("");setCompletedOn("");}}>
                <option value="">Choose a workshop you&apos;ve attended</option>
                {workshops.map(item => <option key={item.id} value={item.id}>{item.title}{item.programArea ? " · " + item.programArea : ""}</option>)}
              </select>
            </label>
            {workshop?.sessions?.length > 0 && <label className={styles.field}>Session date
              <select required value={sessionId} onChange={event=>{const id=event.target.value;setSessionId(id);setCompletedOn(workshop.sessions.find(session=>session.id===id)?.startDate||"");}}>
                <option value="">Choose the date you attended</option>
                {workshop.sessions.map(session=><option key={session.id} value={session.id}>{session.startDate}{session.time?" · "+session.time:""}{session.status==="archived"?" (past)":""}</option>)}
              </select>
            </label>}
            <label className={styles.field}>When did you attend?
              <input type="date" max={new Date().toISOString().slice(0, 10)} required value={completedOn} onChange={event => setCompletedOn(event.target.value)}/>
            </label>
            {workshop && <p className={styles.xpPreview}><Sparkles size={17} aria-hidden="true"/> Earn <strong>{halfXp} XP</strong> for this self-reported completion.</p>}
            <label className={styles.attestation}>
              <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />
              <span>I confirm that I actually attended this workshop. SAIT staff may review or reverse this claim.</span>
            </label>
            <button type="submit" disabled={submitting || !selected || !completedOn || !confirmed || (workshop?.sessions?.length > 0 && !sessionId)} className={styles.save}>
              {submitting ? <><LoaderCircle size={18} aria-hidden="true"/> Saving…</> : <><CheckCircle2 size={18} aria-hidden="true"/> Save my completion</>}
            </button>
          </form>}
          <p className={styles.trust}><ShieldCheck size={15} aria-hidden="true"/> QR-verified attendance always earns full XP. No extra XP is given for duplicate claims.</p>
        </div>
      )}
      {message && <p role="status" className={styles.success}>{message}</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
  );
}
