"use client";
import "./report-print.css";
import { useEffect, useState } from "react";
import { FileText, Download, Search, ShieldCheck, Printer, ArrowUpRight, GraduationCap, Award, Activity, BookOpen, ChartNoAxesCombined, FileSearch, CheckCircle2, Users } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(item => typeof item === "object" ? JSON.stringify(item) : String(item)).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function labelFor(key) { return key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim(); }

export default function AdminReportsPage() {
  const [youthId, setYouthId] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("youthId");
    if (value && value.length <= 80) queueMicrotask(() => setYouthId(value));
  }, []);

  async function loadReport(event) {
    event?.preventDefault();
    if (!youthId.trim()) return;
    setError("");
    setLoading(true);
    setReport(null);
    try {
      const response = await adminFetch("/api/admin/reports/student?youthId=" + encodeURIComponent(youthId.trim()));
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Report unavailable.");
      setReport(data.report);
    } catch (err) { setError(err.message || "Unable to generate report."); }
    finally { setLoading(false); }
  }

  async function exportCsv() {
    if (!report || exporting) return;
    setError("");
    setExporting(true);
    try {
      const response = await adminFetch("/api/admin/reports/student?format=csv&youthId=" + encodeURIComponent(report.student.youthId));
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Export denied.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "youth-initiative-student-report.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message || "Export failed."); }
    finally { setExporting(false); }
  }

  const registrations = report?.registrations || [];
  const badges = report?.badges || [];
  const xpHistory = report?.xpHistory || [];
  return <main className="admin-report-print admin-reports-redesign mx-auto max-w-6xl px-4 py-8 md:px-8">
    <div className="admin-reports-heading">
      <p className="admin-section-eyebrow"><ChartNoAxesCombined size={16}/> STUDENT INTELLIGENCE</p>
      <h1>Meaningful progress, <span>made visible.</span></h1>
      <p>Pull together student participation, achievements and program activity in one secure report.</p>
    </div>
    <section className="admin-report-search-panel">
      <div className="flex items-center gap-3"><span className="admin-panel-icon"><FileSearch size={23}/></span><div><h2>Find a student report</h2><p>Search using the student’s exact Youth Initiative ID.</p></div></div>
      <form onSubmit={loadReport} className="admin-report-search-form">
        <label htmlFor="report-youth-id">Youth Initiative ID</label>
        <div className="admin-report-search-row">
          <div className="admin-report-search-input"><Search size={19}/><input id="report-youth-id" value={youthId} onChange={e => setYouthId(e.target.value)} placeholder="Enter a Youth ID" autoComplete="off" required maxLength={80}/></div>
          <button disabled={loading} type="submit"><FileText size={18}/>{loading ? "Generating…" : "Generate report"}<ArrowUpRight size={17}/></button>
        </div>
      </form>
      {error && <div className="admin-auth-alert error mt-4" role="alert"><ShieldCheck size={18}/><span>{error}</span></div>}
    </section>

    {!report && !loading && <section className="admin-reports-empty">
      <div className="admin-reports-empty-icon"><FileText size={35}/></div>
      <h2>Student insights start here.</h2>
      <p>Enter a Youth ID to explore workshop registrations, XP activity, achievements and profile details. Reports are accessible only to authorized team members.</p>
      <div><ShieldCheck size={17}/> Privacy-first, access-controlled reports</div>
    </section>}

    {loading && <section className="admin-reports-empty" role="status"><div className="admin-reports-empty-icon animate-pulse"><FileSearch size={35}/></div><h2>Preparing student report…</h2><p>Retrieving current records from Azure Cosmos DB.</p></section>}

    {report && <section className="admin-reports-result">
      <div className="admin-reports-result-head">
        <div className="flex items-center gap-4"><span className="admin-reports-avatar">{(report.student.firstName || "S").charAt(0).toUpperCase()}</span><div><span className="admin-panel-kicker">STUDENT PROGRESS REPORT</span><h2>{report.student.firstName} {report.student.lastName}</h2><p>{report.student.youthId}</p></div></div>
        <div className="admin-reports-actions">
          <button type="button" onClick={() => window.print()}><Printer size={17}/> Print / Save PDF</button>
          <button type="button" onClick={exportCsv} disabled={exporting}><Download size={17}/>{exporting ? "Exporting…" : "Export CSV"}</button>
        </div>
      </div>

      <div className="admin-reports-stats">
        <div><span><BookOpen size={18}/></span><strong>{registrations.length}</strong><small>Workshop registrations</small></div>
        <div><span><Award size={18}/></span><strong>{badges.length}</strong><small>Badges awarded</small></div>
        <div><span><Activity size={18}/></span><strong>{xpHistory.length}</strong><small>XP transactions</small></div>
        <div><span><GraduationCap size={18}/></span><strong>{formatValue(report.student.level || 1)}</strong><small>Student level</small></div>
      </div>

      <section className="admin-report-section"><div className="admin-report-section-heading"><span><Users size={19}/></span><div><h3>Student information</h3><p>Profile details on record</p></div></div>
        <dl className="admin-report-details">{Object.entries(report.student).map(([key,value]) => <div key={key}><dt>{labelFor(key)}</dt><dd>{formatValue(value)}</dd></div>)}</dl>
      </section>

      <section className="admin-report-section"><div className="admin-report-section-heading"><span><ChartNoAxesCombined size={19}/></span><div><h3>Learning journey</h3><p>Progress and engagement information</p></div></div>
        <dl className="admin-report-details">{Object.entries(report.journey || {}).map(([key,value]) => <div key={key}><dt>{labelFor(key)}</dt><dd>{formatValue(value)}</dd></div>)}</dl>
        {!Object.keys(report.journey || {}).length && <p className="admin-report-none">No learning journey information recorded yet.</p>}
      </section>

      <section className="admin-report-section"><div className="admin-report-section-heading"><span><BookOpen size={19}/></span><div><h3>Workshop participation <small>({registrations.length})</small></h3><p>Registrations and check-in status</p></div></div>
        <div className="admin-report-list">{registrations.length ? registrations.map((r,i) => <div className="admin-report-list-item" key={i}><span className="admin-report-list-icon"><BookOpen size={18}/></span><div><strong>{r.workshopTitle || "Workshop"}</strong><p>{r.status || "Unknown"} · Attendance: {r.attendanceStatus || "Not recorded"}</p></div><CheckCircle2 size={18} className="text-slate-300"/></div>) : <p className="admin-report-none">No workshop registrations recorded yet.</p>}</div>
      </section>

      <div className="admin-reports-two-columns">
        <section className="admin-report-section"><div className="admin-report-section-heading"><span><Award size={19}/></span><div><h3>Achievements <small>({badges.length})</small></h3><p>Student badges</p></div></div><div className="admin-report-list">{badges.length ? badges.map((badge,i)=><div className="admin-report-list-item" key={i}><span className="admin-report-list-icon gold"><Award size={18}/></span><strong>{badge.badgeName || badge.badgeId || "Badge"}</strong></div>) : <p className="admin-report-none">No badges earned yet.</p>}</div></section>
        <section className="admin-report-section"><div className="admin-report-section-heading"><span><Activity size={19}/></span><div><h3>XP history <small>({xpHistory.length})</small></h3><p>Recorded progress events</p></div></div><div className="admin-report-list">{xpHistory.length ? xpHistory.map((xp,i) => <div className="admin-report-list-item" key={i}><span className="admin-report-list-icon"><Activity size={17}/></span><div><strong>{xp.status || "Recorded"}</strong><p>{xp.completedAt || xp.createdAt || "Date unavailable"}</p></div><strong className="admin-report-xp">+{xp.amount ?? "—"} XP</strong></div>) : <p className="admin-report-none">No XP history recorded yet.</p>}</div></section>
      </div>
      <div className="admin-report-confidential"><ShieldCheck size={16}/> Confidential student information · Generated {new Date(report.generatedAt).toLocaleString()}</div>
    </section>}
  </main>;
}
