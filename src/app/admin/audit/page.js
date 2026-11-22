"use client";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, RefreshCw, Clock3, FileSearch, Search, Activity } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

export default function AdminAuditPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    adminFetch("/api/admin/audit").then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Audit history unavailable.");
      if (active) setEvents(Array.isArray(result.events) ? result.events : []);
    }).catch(err => { if (active) setError(err.message || "Could not load audit records."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const filtered = useMemo(() => events.filter(item =>
    [item.staffName,item.actionLabel,item.outcome].some(value => String(value || "").toLowerCase().includes(query.trim().toLowerCase()))), [events,query]);

  return <main className="admin-audit-redesign mx-auto max-w-7xl px-4 py-8 md:px-8">
    <header className="admin-team-intro">
      <div><p className="admin-section-eyebrow"><ShieldCheck size={15}/> GOVERNANCE & OVERSIGHT</p>
        <h1>Audit activity<span>.</span></h1>
        <p>See who performed an action, when it happened, and its recorded outcome.</p>
      </div>
      <button className="admin-team-refresh" disabled={loading} type="button" onClick={()=>{setLoading(true);setError("");setRevision(v=>v+1);}}><RefreshCw size={18} className={loading ? "animate-spin" : ""}/> Refresh activity</button>
    </header>
    <div className="admin-audit-overview">
      <div className="admin-panel-icon violet"><Activity size={22}/></div>
      <div><strong>Administrative oversight</strong><span>Attempted means the log has no confirmed outcome.</span></div>
      <div className="admin-audit-total">{loading ? "…" : events.length}<small>Events</small></div>
    </div>
    <section className="admin-audit-panel">
      <div className="admin-audit-panel-head"><div><h2>Recent administrator activity</h2><p>Search by staff name, action or outcome.</p></div><div className="admin-audit-search"><Search size={17}/><input type="search" aria-label="Search audit events" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter activity…"/></div></div>
      {error && <div className="admin-auth-alert error m-5" role="alert"><ShieldCheck size={18}/>{error}</div>}
      {loading ? <div className="admin-audit-empty" role="status"><RefreshCw size={30} className="animate-spin"/><h3>Loading audit history</h3><p>Retrieving protected records.</p></div> :
       filtered.length === 0 ? <div className="admin-audit-empty"><FileSearch size={36}/><h3>{events.length ? "No matching activity" : "No audit events yet"}</h3><p>{events.length ? "Try a different search." : "Recorded administrator activity will appear here."}</p></div> :
       <div className="overflow-x-auto"><table className="admin-audit-table"><thead><tr><th>When</th><th>Staff member</th><th>Action</th><th>Outcome</th></tr></thead><tbody>
        {filtered.map(event => <tr key={event.id}><td><span className="admin-audit-time"><Clock3 size={14}/>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "Unknown"}</span></td>
          <td><span className="admin-audit-staff">{event.staffName}</span></td>
          <td><span className="admin-audit-action">{event.actionLabel}</span></td>
          <td><span className="admin-audit-outcome" data-outcome={event.outcome}>{event.outcome}</span></td></tr>)}
       </tbody></table></div>}
    </section>
  </main>;
}
