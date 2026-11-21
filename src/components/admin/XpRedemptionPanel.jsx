"use client";

import { useEffect, useRef, useState } from "react";
import { Gift } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

export default function XpRedemptionPanel({ student, onRedeemed, onBusyChange, requireReward = false }) {
  const [canRedeem, setCanRedeem] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState([]);
  const [balance, setBalance] = useState(student.currentXp ?? student.totalXp ?? 0);
  const [loading, setLoading] = useState(false);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const operationRef = useRef(null);
  const submitting = useRef(false);

  useEffect(() => {
    let allowed = false;
    try { allowed = JSON.parse(sessionStorage.getItem("adminSession") || "{}").permissions?.includes("xp.redeem") === true; }
    catch { allowed = false; }
    let active = true;
    queueMicrotask(() => { if (active) setCanRedeem(allowed); });
    if (!allowed) return () => { active = false; };
    adminFetch("/api/admin/rewards?studentId=" + encodeURIComponent(student.id))
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.message || "Could not load redemption history."); return result; })
      .then(result => { if (active) { setBalance(result.currentXp); setHistory(result.history || []); setBalanceLoaded(true); } })
      .catch(cause => { if (active) setError(cause.message || "Could not load redemption history."); });
    return () => { active = false; };
  }, [student.id]);

  if (!canRedeem) return null;

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || (requireReward && (!balanceLoaded || !note.trim()))) return;
    const points = Number(amount);
    if (!Number.isSafeInteger(points) || points <= 0 || points > balance) {
      setError("Enter a whole number of XP no greater than the student's Current XP.");
      return;
    }
    submitting.current = true;
    onBusyChange?.(true);
    setLoading(true); setError(""); setNotice("");
    if (!operationRef.current) operationRef.current = crypto.randomUUID();
    try {
      const response = await adminFetch("/api/admin/rewards", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, amount: points, note, operationId: operationRef.current }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "XP could not be redeemed.");
      operationRef.current = null;
      setNotice(result.message);
      if (Number.isFinite(result.currentXp)) {
        setBalance(result.currentXp);
        onRedeemed?.({ currentXp: result.currentXp, totalXp: result.totalXp });
      } else {
        setBalanceLoaded(false);
      }
      setAmount(""); setNote("");
      const refreshed = await adminFetch("/api/admin/rewards?studentId=" + encodeURIComponent(student.id));
      if (refreshed.ok) {
        const latest = await refreshed.json();
        setBalance(latest.currentXp);
        setHistory(latest.history || []);
        setBalanceLoaded(true);
        if (!Number.isFinite(result.currentXp)) {
          onRedeemed?.({ currentXp: latest.currentXp, totalXp: latest.totalXp });
        }
      }
    } catch (cause) {
      setError(cause.message || "Unable to redeem XP. Check the ledger before trying again.");
    } finally {
      submitting.current = false;
      onBusyChange?.(false);
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5" aria-label="Event XP redemption">
      <div className="mb-3 flex items-center gap-2 text-amber-900"><Gift size={21}/><h3 className="text-base font-extrabold">Redeem XP at an event</h3></div>
      <p className="mb-4 text-sm text-slate-600">XP available to spend: <strong>{balanceLoaded || !requireReward ? balance : "—"}</strong>. Redeeming rewards preserves Lifetime XP and level progress.</p>
      <form onSubmit={submit} className="grid gap-3">
        <label className="grid gap-1 text-xs font-bold text-slate-700">XP to redeem
          <input className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" inputMode="numeric" type="number" min="1" max={balance} step="1" required disabled={loading} value={amount} onChange={event => { setAmount(event.target.value); operationRef.current = null; }}/>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">{requireReward ? "Reward and event" : "Event or reward note (optional)"}
          <input className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" maxLength={200} required={requireReward} disabled={loading} placeholder="Open House – hoodie" value={note} onChange={event => {setNote(event.target.value); operationRef.current = null;}}/>
        </label>
        <button type="submit" disabled={loading || balance <= 0 || (requireReward && (!balanceLoaded || !note.trim()))} className="min-h-11 rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Processing redemption…" : "Confirm XP redemption"}
        </button>
      </form>
      {notice && <p className="mt-3 text-sm font-semibold text-emerald-800" role="status">{notice}</p>}
      {error && <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      <div className="mt-5 border-t border-amber-200 pt-4">
        <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-600">Recent redemptions for this student</h4>
        {!history.length ? <p className="text-xs text-slate-500">No redemptions recorded for this student.</p> :
          <div className="max-h-40 space-y-2 overflow-y-auto">{history.map(item => (
            <div key={item.id} className="flex justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
              <div><strong>{item.amount} XP</strong><span className="ml-2">{item.note || "Event reward"}</span><p className="mt-1 text-slate-500">{item.actorEmail} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recorded"} · {item.status}</p></div>
            </div>
          ))}</div>}
      </div>
    </section>
  );
}
