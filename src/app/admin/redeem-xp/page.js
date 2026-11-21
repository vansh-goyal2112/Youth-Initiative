"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import XpRedemptionPanel from "@/components/admin/XpRedemptionPanel";
import { adminFetch } from "@/services/adminApi";

async function readRewards(params, signal) {
  const response = await adminFetch("/api/admin/rewards?" + params, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Could not load redemption data.");
  return data;
}

export default function RedeemXpPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(null);
  const [students, setStudents] = useState([]);
  const [student, setStudent] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!query) return;
    const request = new AbortController();
    readRewards(new URLSearchParams({ search: query.name }), request.signal)
      .then(result => { if (!request.signal.aborted) setStudents(result.students); })
      .catch(error => { if (!request.signal.aborted) setError(error.message); })
      .finally(() => { if (!request.signal.aborted) setSearching(false); });
    return () => request.abort();
  }, [query]);

  useEffect(() => {
    const request = new AbortController();
    readRewards(new URLSearchParams({ view: "recent" }), request.signal)
      .then(result => {
        if (request.signal.aborted) return;
        setHistory(result.history);
        setHistoryError("");
      })
      .catch(error => { if (!request.signal.aborted) setHistoryError(error.message); });
    return () => request.abort();
  }, [refresh]);

  function searchStudents(event) {
    event.preventDefault();
    const name = search.trim();
    if (redeeming || name.length < 2) return;
    setStudent(null);
    setError("");
    setSearching(true);
    setStudents([]);
    setQuery({ name });
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-7 md:px-8">
      <header>
        <h1 className="text-3xl font-extrabold">Redeem XP</h1>
        <p className="mt-2 text-sm text-slate-600">Find a student and record an in-person reward.</p>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Find a student">
        <form onSubmit={searchStudents}>
          <label htmlFor="redemption-search" className="text-sm font-bold">Student name or Youth ID</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input id="redemption-search" type="search" required minLength={2} maxLength={100}
              disabled={redeeming} value={search} onChange={event => setSearch(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5" />
            <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white disabled:opacity-60" type="submit" disabled={redeeming}>
              <Search size={17} aria-hidden="true" /> Search
            </button>
          </div>
        </form>
        {searching && <p role="status" className="mt-4 text-sm text-slate-600">Searching…</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {query && !searching && !error && (
          students.length ? <ul className="mt-4 space-y-2">
            {students.map(result => (
              <li key={result.id}>
                <button type="button" disabled={redeeming} aria-pressed={student?.id === result.id}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-slate-50 aria-pressed:border-amber-500 aria-pressed:bg-amber-50"
                  onClick={() => setStudent(result)}>
                  <span className="font-bold">{result.name}</span>
                  <span className="text-sm text-slate-600">{result.youthId || "No Youth ID"}{result.accountStatus === "inactive" && " · Inactive"}</span>
                </button>
              </li>
            ))}
          </ul> : <p className="mt-4 text-sm text-slate-600">No students matched that search.</p>
        )}
      </section>
      {student && <section aria-labelledby="redemption-student">
        <h2 id="redemption-student" className="text-xl font-bold">{student.name}{student.youthId && ` · ${student.youthId}`}</h2>
        <XpRedemptionPanel key={student.id} student={student} requireReward onBusyChange={setRedeeming} onRedeemed={() => setRefresh(value => value + 1)} />
      </section>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="redemption-recent">
        <h2 id="redemption-recent" className="text-xl font-bold">Recent redemptions</h2>
        {historyError ? <p className="mt-3 text-sm text-red-700" role="alert">{historyError}</p> :
          !history ? <p className="mt-3 text-sm text-slate-600" role="status">Loading recent redemptions…</p> :
          history.length ? <ul className="mt-3 divide-y divide-slate-100">
            {history.map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <div><strong>{item.name}</strong><p className="text-slate-600">{item.note || "Event reward"}</p>
                {item.createdAt && <time dateTime={item.createdAt} className="text-slate-500">{new Date(item.createdAt).toLocaleString("en-CA", { timeZone: "America/Edmonton" })}</time>}
              </div>
              <strong>{item.amount} XP{item.status === "processing" && " · Needs review"}</strong>
            </li>)}
          </ul> : <p className="mt-3 text-sm text-slate-600">No recent redemptions.</p>}
      </section>
    </main>
  );
}
