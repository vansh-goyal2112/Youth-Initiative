"use client";
import "./report-print.css";
import { useEffect, useState } from "react";
import { FileText, Download, Search, ShieldCheck, Printer, GraduationCap, Award, Activity, BookOpen, ChartNoAxesCombined, FileSearch, CheckCircle2, Users } from "lucide-react";
import { adminFetch } from "@/services/adminApi";
import { isSelfReportedCompletion } from "@/utils/completionSourceLabels.mjs";

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(item => typeof item === "object" ? JSON.stringify(item) : String(item)).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function labelFor(key) { return key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim(); }

const birthDateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium", timeZone: "UTC",
});

function formatBirthDate(value) {
  if (!value) return "Not on record";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not on record" : birthDateFormatter.format(date);
}

export default function AdminReportsPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("youthId");
    if (value && value.length <= 80) queueMicrotask(() => setSearch(value));
  }, []);

  async function findStudents(event) {
    event.preventDefault();
    const term = search.trim();
    if (term.length < 2) {
      setError("Enter at least two characters.");
      return;
    }
    setError("");
    setSearching(true);
    setResults(null);
    setReport(null);
    try {
      const response = await adminFetch("/api/admin/reports/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search: term }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Student search unavailable.");
      setResults(data);
    } catch (err) { setError(err.message || "Unable to search for students."); }
    finally { setSearching(false); }
  }

  async function loadReport(youthId) {
    setError("");
    setLoading(true);
    setReport(null);
    try {
      const response = await adminFetch("/api/admin/reports/student?youthId=" + encodeURIComponent(youthId));
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
      link.download = "youth-initiatives-student-report.csv";
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
      <div className="flex items-center gap-3"><span className="admin-panel-icon"><FileSearch size={23}/></span><div><h2>Find a student report</h2><p>Search by student name, email or Youth ID.</p></div></div>
      <form onSubmit={findStudents} className="admin-report-search-form">
        <label htmlFor="report-student-search">Student name, email or Youth ID</label>
        <div className="admin-report-search-row">
          <div className="admin-report-search-input"><Search size={19}/><input id="report-student-search" type="search" value={search} onChange={e => { setSearch(e.target.value); setResults(null); setError(""); }} placeholder="Enter a name, email or Youth ID" autoComplete="off" disabled={searching || loading || exporting} required minLength={2} maxLength={254}/></div>
          <button disabled={searching || loading || exporting} type="submit"><Search size={18}/>{searching ? "Searching…" : "Search students"}</button>
        </div>
      </form>
      {searching && <p className="mt-4 text-sm text-slate-600" role="status">Searching for students…</p>}
      {results?.students.length === 0 && <p className="mt-4 text-sm text-slate-600" role="status">No students found. Try another name, email or Youth ID.</p>}
      {results?.students.length > 0 && <div className="mt-5">
        <h3 className="mb-2 text-sm font-bold">Matching students</h3>
        {results.hasMore && <p className="mb-2 text-sm text-slate-600" role="status">Showing 25 matches. Refine your search to narrow the list.</p>}
        <ul className="grid gap-2" aria-label="Matching students">
          {results.students.map((student, index) => <li key={`${student.youthId}-${index}`}>
            <button type="button" disabled={loading || exporting} onClick={() => loadReport(student.youthId)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-60">
              <span><strong className="block text-sm text-slate-900">{student.name}</strong>
                <span className="block text-xs text-slate-600">Birth date: {formatBirthDate(student.dateOfBirth)} · {student.youthId}</span>
              </span>
              <span className="text-sm font-semibold text-indigo-800">Generate report</span>
            </button>
          </li>)}
        </ul>
      </div>}
      {error && <div className="admin-auth-alert error mt-4" role="alert"><ShieldCheck size={18}/><span>{error}</span></div>}
    </section>

    {!report && !loading && !searching && !results && <section className="admin-reports-empty">
      <div className="admin-reports-empty-icon"><FileText size={35}/></div>
      <h2>Student insights start here.</h2>
      <p>Find a student to explore workshop registrations, XP activity, achievements and profile details. Reports are accessible only to authorized team members.</p>
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
        <div className="admin-report-list">{registrations.length ? registrations.map((r,i) => <div className="admin-report-list-item" key={i}><span className="admin-report-list-icon"><BookOpen size={18}/></span><div>
          <strong>{r.workshopTitle || "Workshop"}</strong>
          {isSelfReportedCompletion(r) && (
            <span className="ml-2 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
              Self-reported
            </span>
          )}
          <p>{r.status || "Unknown"} · Attendance: {r.attendanceStatus || "Not recorded"}</p>
        </div><CheckCircle2 size={18} className="text-slate-300"/></div>) : <p className="admin-report-none">No workshop registrations recorded yet.</p>}</div>
      </section>

      <div className="admin-reports-two-columns">
        <section className="admin-report-section"><div className="admin-report-section-heading"><span><Award size={19}/></span><div><h3>Achievements <small>({badges.length})</small></h3><p>Student badges</p></div></div><div className="admin-report-list">{badges.length ? badges.map((badge,i)=><div className="admin-report-list-item" key={i}><span className="admin-report-list-icon gold"><Award size={18}/></span><strong>{badge.badgeName || badge.badgeId || "Badge"}</strong></div>) : <p className="admin-report-none">No badges earned yet.</p>}</div></section>
        <section className="admin-report-section"><div className="admin-report-section-heading"><span><Activity size={19}/></span><div><h3>XP history <small>({xpHistory.length})</small></h3><p>Recorded progress events</p></div></div><div className="admin-report-list">{xpHistory.length ? xpHistory.map((xp,i) => <div className="admin-report-list-item" key={i}><span className="admin-report-list-icon"><Activity size={17}/></span><div><strong>{xp.status || "Recorded"}</strong><p>{xp.completedAt || xp.createdAt || "Date unavailable"}</p></div><strong className="admin-report-xp">+{xp.amount ?? "—"} XP</strong></div>) : <p className="admin-report-none">No XP history recorded yet.</p>}</div></section>
      </div>
      <div className="admin-report-confidential"><ShieldCheck size={16}/> Confidential student information · Generated {new Date(report.generatedAt).toLocaleString()}</div>
    </section>}
  </main>;
}
