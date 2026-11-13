"use client";

import { useEffect, useState } from "react";
import { Archive, CalendarDays, Copy, Edit3, LoaderCircle, Plus, Save, X } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

const empty = {
  startDate: "", endDate: "", time: "", location: "",
  capacity: "", registrationUrl: "", status: "active",
};

export default function WorkshopSessionsPanel({ workshop, onClose, onUpdated }) {
  const [sessions, setSessions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showEditor, setShowEditor] = useState(false);

  async function load() {
    const response = await adminFetch("/api/admin/workshops/sessions?workshopId=" + encodeURIComponent(workshop.id));
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to load workshop sessions.");
    setSessions(result.sessions || []);
  }

  useEffect(() => {
    let active = true;
    adminFetch("/api/admin/workshops/sessions?workshopId=" + encodeURIComponent(workshop.id))
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load sessions.");
        if (active) setSessions(result.sessions || []);
      })
      .catch(cause => { if (active) setError(cause.message || "Unable to load sessions."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workshop.id]);

  function startEditing(session) {
    setEditing(session.id);
    setForm({
      startDate: session.startDate || "", endDate: session.endDate || "",
      time: session.time || "", location: session.location || "",
      capacity: session.capacity ?? "", registrationUrl: session.registrationUrl || "",
      status: session.status || "active",
    });
    setShowEditor(true); setError(""); setMessage("");
  }

  function startCreating() {
    setEditing(null); setForm(empty); setShowEditor(true); setError(""); setMessage("");
  }

  async function action(type, sessionId = null) {
    if (saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await adminFetch("/api/admin/workshops/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workshopId: workshop.id, action: type, ...(sessionId ? { sessionId } : {}),
          ...(type === "add" || type === "edit" ? { session: form } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Session could not be saved.");
      setSessions(result.sessions || []);
      setMessage(type === "duplicate" ? "A draft session was duplicated and archived; edit its dates before publishing." : result.message);
      setShowEditor(false); setEditing(null); setForm(empty);
      if (typeof onUpdated === "function") await onUpdated();
    } catch (cause) {
      setError(cause.message || "Session could not be saved.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm md:p-6" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="workshop-sessions-title" className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-rose-50 to-white px-5 py-5 md:px-7">
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-rose-700"><CalendarDays size={15}/> Workshop schedule</p>
            <h2 id="workshop-sessions-title" className="truncate text-xl font-black">{workshop.title}</h2>
            <p className="text-xs text-slate-600">Each date can have its own capacity, location, status and registration link.</p>
          </div>
          <button className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100" type="button" onClick={onClose} aria-label="Close workshop sessions"><X size={21}/></button>
        </div>
        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5 md:p-7">
          {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{message}</p>}
          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800" role="alert">{error}</p>}
          {loading ? <p className="flex items-center gap-2 text-slate-600"><LoaderCircle size={18} className="animate-spin"/> Loading workshop sessions…</p> :
            sessions.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No session dates have been added. Add the first date to advertise a specific registration link.</p> :
            <div className="space-y-3">{sessions.map(session => (
              <div key={session.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong className="text-sm font-black text-slate-900">{session.startDate}{session.endDate && session.endDate !== session.startDate ? " – " + session.endDate : ""}</strong>
                    <span className={"ml-2 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase " +
                      (session.status === "archived" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-800")}>{session.status}</span>
                    <p className="mt-1 text-xs text-slate-600">{[session.time, session.location, session.capacity != null ? "Capacity " + session.capacity : ""].filter(Boolean).join(" · ")}</p>
                    {session.registrationUrl && <a className="mt-1 block max-w-sm truncate text-xs font-bold text-indigo-700 underline" href={session.registrationUrl} target="_blank" rel="noopener noreferrer">Open registration link</a>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" title="Edit date" disabled={saving} className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50" onClick={() => startEditing(session)}><Edit3 size={17}/></button>
                    <button type="button" title="Duplicate date" disabled={saving} className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50" onClick={() => action("duplicate",session.id)}><Copy size={17}/></button>
                    {session.status !== "archived" && <button type="button" title="Archive date" disabled={saving} className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100" onClick={() => action("archive",session.id)}><Archive size={17}/></button>}
                  </div>
                </div>
              </div>
            ))}</div>}
          {showEditor ? (
            <form onSubmit={event => {event.preventDefault();action(editing ? "edit":"add",editing);}} className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50/40 p-4 md:p-5">
              <h3 className="font-extrabold">{editing ? "Edit session" : "Add a session"}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["startDate", "Start date", "date"], ["endDate", "End date", "date"],
                  ["time", "Time", "text"], ["location", "Location", "text"],
                  ["capacity", "Capacity", "number"], ["registrationUrl", "Registration URL", "url"],
                ].map(([key,label,type])=>(
                  <label key={key} className="grid gap-1.5 text-xs font-bold text-slate-700">{label}
                    <input type={type} min={type === "number" ? 0 : undefined} required={key==="startDate"}
                      className="min-h-11 rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
                      value={form[key]} onChange={event => setForm(current=>({...current,[key]:event.target.value}))}/>
                  </label>
                ))}
              </div>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Status
                <select className="min-h-11 rounded-xl border border-slate-300 bg-white p-2.5 text-sm" value={form.status} onChange={event=>setForm(current=>({...current,status:event.target.value}))}>
                  <option value="active">Active</option><option value="archived">Archived</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-5 py-2 text-sm font-extrabold text-white hover:bg-rose-800 disabled:opacity-60"><Save size={17}/>{saving?"Saving…":"Save session"}</button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold" onClick={()=>setShowEditor(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={startCreating} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-5 py-2 text-sm font-extrabold text-white hover:bg-rose-800"><Plus size={18}/> Add session date</button>
          )}
        </div>
      </section>
    </div>
  );
}
