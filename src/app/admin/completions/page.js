"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock3, LoaderCircle, RefreshCw, RotateCcw, Search, ShieldCheck, XCircle } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

export default function CompletionReviewsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [filter, setFilter] = useState("pending_review");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reversingId, setReversingId] = useState("");
  const [reason, setReason] = useState("");
  const [canReverse, setCanReverse] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      try {
        setCanReverse(JSON.parse(sessionStorage.getItem("adminSession") || "{}").permissions?.includes("completion.reverse") === true);
      } catch { setCanReverse(false); }
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    adminFetch("/api/admin/completions")
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load completion claims.");
        if (alive) setClaims(data.completions || []);
      })
      .catch(cause => { if (alive) setError(cause.message || "Unable to load completion claims."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return claims.filter(claim => (filter === "all" || claim.reviewStatus === filter) &&
      (!query || [claim.name, claim.youthId, claim.workshopTitle, claim.programArea]
        .some(value => String(value || "").toLowerCase().includes(query))));
  }, [claims, filter, search]);

  const eligible = filtered.filter(claim => claim.reviewStatus === "pending_review" && claim.status === "completed");
  const selected = eligible.filter(claim => selectedIds.includes(claim.id));
  const busy = Boolean(workingId) || bulkApproving;

  async function requestAction(claim, action) {
    const response = await adminFetch("/api/admin/completions", {
      method: action === "approve" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registrationId: claim.id, action, ...(action === "reverse" ? { reason } : {}),
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "The completion could not be updated.");
    return result;
  }

  async function takeAction(claim, action) {
    if (busy) return;
    setWorkingId(claim.id); setError(""); setMessage("");
    try {
      const result = await requestAction(claim, action);
      setMessage(result.message || "Completion updated.");
      setSelectedIds(ids => ids.filter(id => id !== claim.id));
      setReason(""); setReversingId("");
      setRefresh(v => v + 1);
    } catch (cause) {
      setError(cause.message || "Could not update this completion.");
    } finally { setWorkingId(""); }
  }

  async function approveSelected() {
    if (busy || loading || !selected.length) return;
    if (!window.confirm(`Approve ${selected.length} selected ${selected.length === 1 ? "claim" : "claims"}? No additional XP will be awarded.`)) return;

    setBulkApproving(true);
    setError("");
    setMessage("");
    setReversingId("");
    setReason("");
    const succeeded = new Set();
    let alreadyApproved = 0;
    try {
      // Limit concurrent requests while keeping each approval permissioned and audited.
      for (let offset = 0; offset < selected.length; offset += 4) {
        const batch = selected.slice(offset, offset + 4);
        const results = await Promise.allSettled(batch.map(claim => requestAction(claim, "approve")));
        results.forEach((result, index) => {
          if (result.status !== "fulfilled") return;
          succeeded.add(batch[index].id);
          if (result.value.alreadyApproved) alreadyApproved += 1;
        });
      }
      const approvedCount = succeeded.size - alreadyApproved;
      const failedCount = selected.length - succeeded.size;
      const summary = [
        approvedCount > 0 && `Approved ${approvedCount}.`,
        alreadyApproved > 0 && `Already approved: ${alreadyApproved}.`,
      ].filter(Boolean).join(" ");
      if (summary) setMessage(summary);
      if (failedCount) setError(`Could not confirm approval for ${failedCount} ${failedCount === 1 ? "claim" : "claims"}. Review the refreshed list before retrying.`);
      setClaims(current => current.map(claim =>
        succeeded.has(claim.id) ? { ...claim, reviewStatus: "approved" } : claim
      ));
      setSelectedIds(ids => ids.filter(id => !succeeded.has(id)));
      setLoading(true);
      setRefresh(value => value + 1);
    } finally {
      setBulkApproving(false);
    }
  }

  const pending = claims.filter(item => item.reviewStatus === "pending_review").length;
  const approved = claims.filter(item => item.reviewStatus === "approved").length;
  const reversed = claims.filter(item => item.reviewStatus === "reversed").length;
  return (
    <main className="min-h-screen bg-[#f5f6fa] px-4 py-8 text-slate-900 md:px-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.15em] text-rose-600"><ClipboardCheck size={16}/> Attendance operations</span>
          <h1 className="text-3xl font-black tracking-tight">Review <span className="text-rose-600">claims</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review self-reported experiences, approve genuine attendance, and reverse incorrect claims. Half XP is awarded when students report an experience; approval does not award it twice.</p>
        </div>
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50" disabled={busy || loading} onClick={() => {setSelectedIds([]);setLoading(true);setRefresh(n=>n+1);}}>
          <RefreshCw size={17}/> Refresh
        </button>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Pending review", pending, "text-amber-800 bg-amber-50 border-amber-200"],
          ["Approved", approved, "text-emerald-800 bg-emerald-50 border-emerald-200"],
          ["Reversed", reversed, "text-rose-800 bg-rose-50 border-rose-200"],
        ].map(([label, value, variant]) => (
          <div key={label} className={"rounded-2xl border p-5 " + variant}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Self-reported completion claims">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <Search size={17} className="text-slate-400"/>
            <input className="w-full min-h-11 border-0 bg-transparent py-2 text-sm outline-none" placeholder="Search student, Youth ID, experience…" aria-label="Search completion claims" disabled={bulkApproving} value={search} onChange={event => { setSearch(event.target.value); setSelectedIds([]); }}/>
          </div>
          <select className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" aria-label="Review status" disabled={bulkApproving} value={filter} onChange={event => { setFilter(event.target.value); setSelectedIds([]); }}>
            <option value="pending_review">Pending review</option>
            <option value="approved">Approved</option>
            <option value="reversed">Reversed</option>
            <option value="all">All claims</option>
          </select>
        </div>
        {!loading && eligible.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="size-4 accent-emerald-700" disabled={busy}
                checked={selected.length === eligible.length}
                onChange={event => setSelectedIds(event.target.checked ? eligible.map(claim => claim.id) : [])} />
              Select all visible pending claims
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600" aria-live="polite">{selected.length} selected</span>
              <button type="button" disabled={busy || selected.length === 0} onClick={approveSelected}
                className="min-h-10 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                {bulkApproving ? "Approving selected…" : "Approve selected"}
              </button>
            </div>
          </div>
        )}
        {message && <p className="m-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status"><CheckCircle2 size={16} className="mr-2 inline"/>{message}</p>}
        {error && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert"><XCircle size={16} className="mr-2 inline"/>{error}</p>}
        {loading ? <p className="flex items-center gap-2 p-8 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={19}/> Loading completion reviews…</p> :
          filtered.length === 0 ? <p className="p-8 text-sm text-slate-500">No completion claims match these filters.</p> :
          <div className="divide-y divide-slate-100">
            {filtered.map(claim => (
              <article key={claim.id} className="p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {claim.reviewStatus === "pending_review" && claim.status === "completed" && (
                    <input type="checkbox" className="mt-1 size-4 accent-emerald-700" disabled={busy}
                      aria-label={`Select ${claim.workshopTitle} claim for ${claim.name}`}
                      checked={selectedIds.includes(claim.id)}
                      onChange={event => {
                        const checked = event.target.checked;
                        setSelectedIds(ids => checked ? [...ids, claim.id] : ids.filter(id => id !== claim.id));
                      }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-extrabold text-slate-900">{claim.workshopTitle}</h2>
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-extrabold tracking-wide text-sky-800">
                        Self-reported
                      </span>
                      <span className={"rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide " +
                        (claim.reviewStatus === "pending_review" ? "bg-amber-100 text-amber-900" :
                         claim.reviewStatus === "approved" ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900")}>{claim.reviewStatus?.replaceAll("_", " ")}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">{claim.name} · {claim.youthId || "Youth ID unavailable"}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>{claim.programArea || "Program area not listed"}</span>
                      <span><Clock3 size={13} className="mr-1 inline"/>Attended {claim.completedOn || "date not listed"}</span>
                      <span className="font-extrabold text-rose-700">{claim.xpAmount} XP</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {claim.reviewStatus === "pending_review" && (
                      <button type="button" disabled={busy} onClick={() => takeAction(claim, "approve")}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-800 disabled:opacity-50">
                        {workingId === claim.id ? <LoaderCircle size={15} className="animate-spin"/> : <CheckCircle2 size={16}/>} Approve
                      </button>
                    )}
                    {canReverse && claim.reviewStatus !== "reversed" && (
                      <button type="button" disabled={busy} onClick={() => { setReversingId(current => current === claim.id ? "" : claim.id); setReason(""); }}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-extrabold text-rose-800 hover:bg-rose-100 disabled:opacity-50">
                        <RotateCcw size={15}/> Reverse
                      </button>
                    )}
                  </div>
                </div>
                {canReverse && reversingId === claim.id && (
                  <form className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4" onSubmit={event => {event.preventDefault();takeAction(claim, "reverse");}}>
                    <label className="block text-xs font-extrabold text-rose-900">Reason for reversal (required)
                      <textarea className="mt-2 min-h-[86px] w-full rounded-xl border border-rose-200 bg-white p-3 text-sm text-slate-800" required minLength={5} maxLength={250} placeholder="Explain why this completion should be reversed" value={reason} onChange={event => setReason(event.target.value)}/>
                    </label>
                    <div className="flex items-start gap-2 text-xs text-rose-800"><ShieldCheck size={15} className="shrink-0"/> Reversing removes unearned XP, recalculates badges, and may record an internal correction if XP was already spent.</div>
                    <button type="submit" disabled={busy || reason.trim().length < 5} className="min-h-10 rounded-xl bg-rose-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-800 disabled:opacity-50">Confirm reversal</button>
                  </form>
                )}
              </article>
            ))}
          </div>}
      </section>
    </main>
  );
}
