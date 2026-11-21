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
  const [gradeRequired, setGradeRequired] = useState(false);
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
        if (!active) return;
        const available = Array.isArray(result.workshops) ? result.workshops : [];
        setGradeRequired(Boolean(result.gradeRequired));
        setWorkshops(available);
        const params = new URLSearchParams(window.location.search);
        const requestedId = params.get("workshop");
        if (requestedId || params.get("claim") === "1") setExpanded(true);
        if (requestedId) {
          if (available.some(item => item.id === requestedId)) {
            setSelected(requestedId);
          } else {
            setError("That workshop has no unclaimed past sessions, or has already been recorded. You can choose another workshop below.");
          }
        }
      })
      .catch(cause => { if (active) setError(cause.message || "Past workshops unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const workshop = workshops.find(item => item.id === selected);

  async function submit(event) {
    event.preventDefault();
    if (submitting || !selected || !completedOn || !confirmed) return;
    setSubmitting(true); setMessage(""); setError("");
    try {
      // The server consumes App Check tokens for claims. Request a fresh
      // limited-use token per submission; the normal cached token is reusable
      // and would fail after the first successfully consumed claim.
      const response = await studentFetch("/api/workshops/self-report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workshopId: selected, sessionId: sessionId || null, completedOn, attested: confirmed }),
      }, { limitedUse: true });
      const result = await response.json();
      if (!response.ok || !result.success) {
        // Another tab may have submitted this workshop already. Remove the
        // stale option immediately rather than inviting another duplicate.
        if (response.status === 409 && result.alreadyClaimed === true) {
          setWorkshops(current => current.filter(item => item.id !== selected));
          setSelected(""); setSessionId(""); setCompletedOn(""); setConfirmed(false);
        }
        throw new Error(result.message || "Could not save your completion.");
      }
      setMessage(result.message);
      // A workshop can contain multiple sessions; after a successful claim,
      // remove the whole program from the dropdown rather than just one date.
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
          <p>Attended a workshop in your current or an earlier grade, or through a school outreach visit? Record it here—no QR code needed.</p>
        </div>
        <button type="button" className={styles.toggle} onClick={() => setExpanded(open => !open)} aria-expanded={expanded} aria-controls="claim-workshop-form">
          {expanded ? "Close" : "Previously Completed"}
        </button>
      </div>
      {expanded && (
        <div id="claim-workshop-form" className={styles.panel}>
          <div className={styles.explainer}><Sparkles size={18} aria-hidden="true"/>
            Self-reported workshops earn <strong>half the regular XP</strong> immediately and remain subject to admin review.
          </div>
          {loading ? <p className={styles.status}><LoaderCircle size={17} aria-hidden="true"/> Loading workshops…</p> :
          gradeRequired ? <p className={styles.status}>Add your current school grade in My Identity before claiming past workshops.</p> :
          workshops.length === 0 ? <p className={styles.status}>No unclaimed workshops are available for your current or earlier grades or school outreach activities.</p> :
          <form onSubmit={submit} className={styles.form}>
            <label className={styles.field}>Workshop
              <select required value={selected} onChange={event => {setSelected(event.target.value);setSessionId("");setCompletedOn("");}}>
                <option value="">Choose a workshop you&apos;ve attended</option>
                {[
                  { id: "current", label: "Your current grade" },
                  { id: "earlier", label: "Earlier grades" },
                  { id: "outreach", label: "School outreach activities" },
                ].filter(group => workshops.some(item => item.claimCategory === group.id))
                  .map(group => <optgroup key={group.id} label={group.label}>
                    {workshops.filter(item => item.claimCategory === group.id)
                      .map(item => <option key={item.id} value={item.id}>
                        {item.title}{item.grade ? " · " + item.grade : ""}
                        {item.programArea ? " · " + item.programArea : ""}
                      </option>)}
                  </optgroup>)}
              </select>
            </label>
            {workshop?.sessions?.length > 0 && <label className={styles.field}>Session date
              <select required value={sessionId} onChange={event=>{const id=event.target.value;setSessionId(id);setCompletedOn(workshop.sessions.find(session=>session.id===id)?.startDate||"");}}>
                <option value="">Choose the date you attended</option>
                {workshop.sessions.map(session=><option key={session.id} value={session.id}>{session.startDate}{session.time?" · "+session.time:""}{session.status==="archived"?" (past)":""}</option>)}
              </select>
            </label>}
            {workshop?.claimCategory === "outreach" && !workshop.sessions?.length &&
              <p className={styles.status}>If you attended with your school, enter the date of your school visit. A personal registration is not required.</p>}
            <label className={styles.field}>When did you attend?
              <input type="date" max={new Date().toISOString().slice(0, 10)} required value={completedOn} onChange={event => setCompletedOn(event.target.value)}/>
            </label>
            {workshop && <p className={styles.xpPreview}><Sparkles size={17} aria-hidden="true"/> Earn <strong>{workshop.xpReward} XP</strong> for this self-reported completion (half the workshop reward).</p>}
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
