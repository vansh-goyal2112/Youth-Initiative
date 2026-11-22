"use client";

import { useMemo, useState } from "react";
import { adminFetch } from "@/services/adminApi";
import { workshopTitleGroup } from "@/utils/workshopCatalogueFields.mjs";

async function readResult(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "The request could not be completed.");
  return data;
}

export default function WorkshopDuplicates({ workshops, onConsolidated }) {
  const [keepId, setKeepId] = useState("");
  const [duplicateId, setDuplicateId] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => {
    const map = new Map();
    for (const workshop of workshops) {
      if (workshop.status !== "active" || workshop.duplicateOf) continue;
      const key = workshopTitleGroup(workshop);
      const group = map.get(key) || [];
      group.push(workshop);
      map.set(key, group);
    }
    return [...map.values()].filter(group => group.length > 1);
  }, [workshops]);
  const matches = groups.find(group => group.some(workshop => workshop.id === keepId)) || [];
  const endpoint = "/api/admin/workshops/duplicates";

  async function review(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (preview) {
        await readResult(await adminFetch(endpoint, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keepId, duplicateId, keepVersion: preview.keepVersion, duplicateVersion: preview.duplicateVersion }),
        }));
        setPreview(null);
        setKeepId("");
        setDuplicateId("");
        onConsolidated();
      } else {
        const params = new URLSearchParams({ keepId, duplicateId });
        setPreview(await readResult(await adminFetch(endpoint + "?" + params)));
      }
    } catch (cause) {
      setPreview(null);
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  const option = workshop => (
    <option key={workshop.id} value={workshop.id}>
      {workshop.title} · {workshop.programArea} · {workshop.startDate || "No date"} · {workshop.xpReward ?? "—"} XP
    </option>
  );

  return <details className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer text-sm font-semibold">Review duplicate workshop titles</summary>
    {groups.length === 0 ? <p className="mt-3 text-sm">No matching active titles found.</p> :
      <form onSubmit={review} className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">Workshop to keep
          <select className="rounded border border-slate-300 p-2" value={keepId} required disabled={busy}
            onChange={event => { setKeepId(event.target.value); setDuplicateId(""); setPreview(null); setError(""); }}>
            <option value="">Select a workshop</option>
            {groups.flat().map(option)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Duplicate to mark inactive
          <select className="rounded border border-slate-300 p-2" value={duplicateId} required disabled={!keepId || busy}
            onChange={event => { setDuplicateId(event.target.value); setPreview(null); setError(""); }}>
            <option value="">Select a duplicate</option>
            {matches.filter(workshop => workshop.id !== keepId).map(option)}
          </select>
        </label>
        {preview && <p role="status" className="text-sm">Keep <strong>{preview.keepTitle}</strong> active and mark <strong>{preview.duplicateTitle}</strong> inactive. You can restore the duplicate from the workshop editor.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className="admin-team-refresh justify-self-start" disabled={busy || !duplicateId} type="submit">
          {busy ? "Checking…" : preview ? "Confirm consolidation" : "Check selected records"}
        </button>
      </form>}
  </details>;
}
