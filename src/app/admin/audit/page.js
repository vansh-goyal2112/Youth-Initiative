"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, Clock, FileSearch } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

export default function AdminAuditPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    adminFetch("/api/admin/audit").then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Audit history unavailable.");
      if (active) setEvents(result.events || []);
    }).catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Access Governance</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Activity & Audit</h1>
        <p className="mt-2 text-sm text-slate-600">A protected history of administrative action attempts. Sensitive request data is never recorded here.</p>
      </div>
      <button className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700" type="button" onClick={()=>{setLoading(true);setError("");setRevision(v=>v+1);}}><RefreshCw size={18}/> Refresh</button>
    </header>
    <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><ShieldCheck className="text-orange-600" size={21}/><h2 className="font-bold text-slate-900">Recent administrator activity</h2></div>
      {error && <p role="alert" className="p-5 text-red-700">{error}</p>}
      {loading ? <p className="p-8 text-slate-500">Loading secure activity records…</p> :
        events.length === 0 ? <div className="flex flex-col items-center gap-3 p-12 text-slate-500"><FileSearch size={35}/><p>No audit records found.</p></div> :
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="p-4">Date</th><th className="p-4">Administrator UID</th><th className="p-4">Permission</th><th className="p-4">Resource</th><th className="p-4">Outcome</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{events.map(e=><tr key={e.id}><td className="whitespace-nowrap p-4 text-slate-700"><span className="flex items-center gap-2"><Clock size={14}/>{new Date(e.createdAt).toLocaleString()}</span></td><td className="p-4 font-mono text-xs text-slate-600">{e.actorUid}</td><td className="p-4 font-semibold text-slate-900">{e.action}</td><td className="p-4 text-slate-600">{e.resource}</td><td className="p-4 capitalize text-slate-600">{e.outcome}</td></tr>)}</tbody>
        </table></div>}
    </section>
  </main>;
}
