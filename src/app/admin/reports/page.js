"use client";
import "./report-print.css";
import { useEffect, useState } from "react";
import { FileText, Download, Search, ShieldCheck, Printer } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

export default function AdminReportsPage() {
  const [youthId, setYouthId] = useState("");
  const [report, setReport] = useState(null);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("youthId");
    if (value && value.length <= 80) queueMicrotask(() => setYouthId(value));
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function loadReport() {
    if (!youthId.trim()) return;
    setError("");
    setLoading(true);
    setReport(null);
    try {
      const response = await adminFetch("/api/admin/reports/student?youthId=" + encodeURIComponent(youthId.trim()));
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Report unavailable.");
      setReport(data.report);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  async function exportCsv() {
    if (!report) return;
    setError("");
    try {
      const response = await adminFetch("/api/admin/reports/student?format=csv&youthId=" + encodeURIComponent(report.student.youthId));
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Export denied.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "youth-initiative-student-report.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  }
  return <main className="admin-report-print mx-auto max-w-5xl px-4 py-8 md:px-8">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Student Insights</p>
    <h1 className="mt-2 text-3xl font-bold text-slate-900">Student Reports</h1>
    <p className="mt-2 text-slate-600">Generate an access-controlled report from live Cosmos DB records.</p>
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <label htmlFor="report-youth-id" className="block text-sm font-semibold text-slate-700">Youth Initiative ID</label>
      <div className="mt-2 flex flex-wrap gap-3">
        <input id="report-youth-id" className="min-w-52 flex-1 rounded-xl border border-slate-300 p-3" value={youthId} onChange={e=>setYouthId(e.target.value)} placeholder="Enter exact Youth ID" autoComplete="off"/>
        <button type="button" onClick={loadReport} disabled={loading} className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white disabled:opacity-50"><Search size={18}/>{loading?"Generating...":"Generate report"}</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    </section>
    {report && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3"><FileText className="text-orange-600"/><div><h2 className="text-xl font-bold text-slate-900">{report.student.firstName} {report.student.lastName}</h2><p className="text-sm text-slate-500">{report.student.youthId}</p></div></div>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"><Printer size={17}/> Print / Save PDF</button>
        <button type="button" onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700"><Download size={17}/> Export CSV</button>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        {Object.entries(report.student).map(([key,value])=><div className="rounded-xl bg-slate-50 p-4" key={key}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g," $1")}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{Array.isArray(value)?value.join(", ")||"—":String(value??"—")}</dd></div>)}
      </dl>
      <h3 className="mt-8 text-lg font-bold text-slate-900">Learning journey</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(report.journey || {}).map(([key,value])=>
        <div key={key} className="rounded-xl border border-slate-200 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g," $1")}</dt><dd className="mt-1 font-semibold text-slate-900">{Array.isArray(value)?value.join(", ")||"—":String(value??"—")}</dd></div>
      )}</dl>
      <h3 className="mt-8 text-lg font-bold text-slate-900">XP transaction history ({report.xpHistory?.length || 0})</h3>
      <div className="mt-3 space-y-2">{(report.xpHistory || []).map((xp,i)=><div key={i} className="flex flex-wrap justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span className="font-semibold text-slate-900">{xp.status || "Recorded"}</span><span className="text-slate-600">{xp.amount ?? "—"} XP · {xp.completedAt || xp.createdAt || "Date unavailable"}</span></div>)}</div>
      <h3 className="mt-8 text-lg font-bold text-slate-900">Workshop registrations ({report.registrations.length})</h3>
      <div className="mt-3 space-y-3">{report.registrations.map((r,i)=><div key={i} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-900">{r.workshopTitle}</p><p className="mt-1 text-sm text-slate-500">{r.status||"Unknown"} · Attendance: {r.attendanceStatus||"Not recorded"}</p></div>)}</div>
      <h3 className="mt-8 text-lg font-bold text-slate-900">Badges ({report.badges.length})</h3>
      <div className="mt-3 space-y-2">{report.badges.map((badge,i)=><p key={i} className="rounded-xl bg-slate-50 p-3 text-slate-700">{badge.badgeName||badge.badgeId||"Badge"}</p>)}</div>
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15}/> Confidential student record · Generated {new Date(report.generatedAt).toLocaleString()}</p>
    </section>}
  </main>;
}
