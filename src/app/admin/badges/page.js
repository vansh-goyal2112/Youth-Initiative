"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, ImagePlus, Layers3, LoaderCircle, Plus, Save, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { adminFetch } from "@/services/adminApi";
import MediaUploader from "@/components/admin/MediaUploader";

const empty = {
  name: "", description: "", artworkUrl: "", status: "active",
  rule: { type: "sessions_any", minCount: 3, matchValue: "" },
};
const RULES = [
  { value: "sessions_any", label: "Any completed workshops or sessions" },
  { value: "sessions_topic", label: "Workshop topic contains keyword" },
  { value: "sessions_program_area", label: "Program area matches" },
];

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(empty);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadBadges() {
    const response = await adminFetch("/api/admin/badges");
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to load custom badges.");
    setBadges(result.badges || []);
  }
  useEffect(() => {
    let active = true;
    adminFetch("/api/admin/badges")
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load custom badges.");
        if (active) setBadges(result.badges || []);
      })
      .catch(cause => { if (active) setError(cause.message || "Unable to load custom badges."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => badges.filter(badge =>
    !search.trim() || [badge.name, badge.description].some(value => String(value || "").toLowerCase().includes(search.toLowerCase().trim()))
  ), [badges, search]);

  function choose(badge) {
    setSelected(badge.id);
    setDraft({
      name: badge.name, description: badge.description || "", artworkUrl: badge.artworkUrl || "",
      status: badge.status || "active",
      rule: { type: badge.rule?.type || "sessions_any",
        minCount: badge.rule?.minCount ?? 3, matchValue: badge.rule?.matchValue || "" },
    });
    setError(""); setMessage("");
  }

  function newBadge() {setSelected(null);setDraft(empty);setError("");setMessage("");}
  function changeRule(key,value) {setDraft(current=>({...current,rule:{...current.rule,[key]:value}}));}

  async function save(event, statusOverride = null) {
    event?.preventDefault?.();
    if (saving) return;
    setSaving(true);setError("");setMessage("");
    try {
      const isEdit = Boolean(selected);
      const response = await adminFetch("/api/admin/badges", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft, ...(isEdit?{id:selected}:{}),
          status: statusOverride || draft.status,
          rule: { ...draft.rule, minCount: Number(draft.rule.minCount) },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Could not save badge.");
      await loadBadges();
      setSelected(result.badge?.id || null);
      setDraft({
        name: result.badge?.name || draft.name,
        description: result.badge?.description || draft.description,
        artworkUrl: result.badge?.artworkUrl || draft.artworkUrl,
        status: result.badge?.status || draft.status,
        rule: result.badge?.rule || draft.rule,
      });
      setMessage(result.message || "Badge saved.");
    } catch (cause) {setError(cause.message || "Unable to save badge.");}
    finally {setSaving(false);}
  }

  const isTopic = draft.rule.type !== "sessions_any";
  const currentBadge = badges.find(b=>b.id===selected);
  return (
    <main className="min-h-screen bg-[#f5f6fa] p-4 text-slate-900 md:p-8">
      <div className="mb-8">
        <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-rose-600"><Sparkles size={15}/> Reward design studio</span>
        <h1 className="text-3xl font-black tracking-tight">Custom <span className="text-rose-600">badges.</span></h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Create real achievements with artwork and safe automatic earning rules. Existing badges and students&apos; historical achievements remain unchanged.</p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Badge catalogue">
          <div className="border-b border-slate-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-extrabold"><Layers3 size={18} className="text-rose-600"/> Badge catalogue</h2>
              <button type="button" onClick={newBadge} className="inline-flex items-center gap-1 rounded-xl bg-rose-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-rose-800"><Plus size={15}/> New</button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
              <Search size={17} className="text-slate-400"/>
              <input className="min-h-10 w-full border-0 bg-transparent text-sm outline-none" aria-label="Search badges" placeholder="Search badge names…" value={search} onChange={event=>setSearch(event.target.value)}/>
            </div>
          </div>
          {loading ? <p className="flex items-center gap-2 p-5 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin"/> Loading badges…</p> :
            filtered.length === 0 ? <p className="p-5 text-sm text-slate-500">No custom badges yet. Create the first one.</p> :
            <div className="max-h-[550px] divide-y divide-slate-100 overflow-y-auto">
              {filtered.map(badge=>(
                <button type="button" key={badge.id} onClick={()=>choose(badge)}
                  className={"flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-rose-50 " +(selected===badge.id?"bg-rose-50":"")}>
                  <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700"><Award size={22}/></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-extrabold">{badge.name}</strong>
                    <small className="mt-1 block text-xs text-slate-500">Complete {badge.rule?.minCount || 1} sessions · {badge.status}</small>
                  </span>
                </button>
              ))}
            </div>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7" aria-label="Badge editor">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-5">
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Badge details</p><h2 className="text-xl font-black">{selected ? "Edit badge" : "Design a new badge"}</h2></div>
            {selected && <button type="button" onClick={newBadge} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><X size={14}/> Clear</button>}
          </div>
          {message && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800" role="status"><CheckCircle2 size={15} className="mr-2 inline"/>{message}</p>}
          {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800" role="alert">{error}</p>}
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Badge name
                <input required maxLength={80} minLength={3} value={draft.name} onChange={event=>setDraft(d=>({...d,name:event.target.value}))} className="min-h-11 rounded-xl border border-slate-300 p-3 text-sm" placeholder="Robotics Explorer"/>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Status
                <select value={draft.status} onChange={event=>setDraft(d=>({...d,status:event.target.value}))} className="min-h-11 rounded-xl border border-slate-300 p-3 text-sm"><option value="active">Active</option><option value="archived">Archived</option></select>
              </label>
            </div>
            <label className="grid gap-1.5 text-xs font-bold text-slate-700">Description
              <textarea maxLength={250} rows={2} value={draft.description} onChange={event=>setDraft(d=>({...d,description:event.target.value}))} className="rounded-xl border border-slate-300 p-3 text-sm" placeholder="Completed 3 Robotics sessions"/>
            </label>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-indigo-800"><ShieldCheck size={17}/> Automatic earning rule</p>
              <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
                <label className="grid gap-1.5 text-xs font-bold text-slate-700">Condition
                  <select value={draft.rule.type} onChange={event=>changeRule("type",event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white p-2.5 text-sm">
                    {RULES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-slate-700">Sessions required
                  <input type="number" min="1" max="50" step="1" value={draft.rule.minCount} onChange={event=>changeRule("minCount",event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white p-2.5 text-sm"/>
                </label>
              </div>
              {isTopic && <label className="mt-3 grid gap-1.5 text-xs font-bold text-slate-700">{draft.rule.type === "sessions_topic" ? "Workshop topic keyword" : "Exact program area"}
                <input required maxLength={80} minLength={2} value={draft.rule.matchValue} onChange={event=>changeRule("matchValue",event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white p-2.5 text-sm" placeholder={draft.rule.type==="sessions_topic"?"Robotics":"Technology"}/>
              </label>}
              <p className="mt-3 text-xs text-slate-600">Each completed session counts once. Reversed sessions do not count, and archived badge definitions stop issuing new awards.</p>
            </div>
            <label className="grid gap-1.5 text-xs font-bold text-slate-700">Artwork HTTPS URL
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3">
                <ImagePlus size={18} className="text-slate-500"/>
                <input type="url" value={draft.artworkUrl} onChange={event=>setDraft(d=>({...d,artworkUrl:event.target.value}))} className="min-h-11 w-full border-0 bg-transparent text-sm outline-none" placeholder="https://.../badge.png"/>
              </div>
            </label>
            {selected && <MediaUploader kind="badge" recordId={selected} initialUrl={draft.artworkUrl} onUploaded={url => setDraft(current=>({...current,artworkUrl:url}))} />}
            {!selected && <p className="text-xs font-semibold text-amber-700">Create this badge first, then use the upload control to attach your own artwork.</p>}
            <p className="text-xs text-slate-500">Artwork recommendation: square PNG or WebP, 512 × 512 px, ideally under 1 MB. Uploaded artwork requires a configured image-storage service; HTTPS URLs can be assigned now.</p>
            {draft.artworkUrl && <div className="rounded-xl border border-slate-200 p-3"><div className="mx-auto h-28 w-28 rounded-xl bg-slate-100 bg-contain bg-center bg-no-repeat" style={{backgroundImage:"url("+JSON.stringify(draft.artworkUrl)+")"}}/><p className="mt-2 text-center text-xs text-slate-500">Artwork preview</p></div>}
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={saving} type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-5 py-2 text-sm font-extrabold text-white hover:bg-rose-800 disabled:opacity-50"><Save size={17}/>{saving?"Saving…":selected?"Save badge":"Create badge"}</button>
              {currentBadge && currentBadge.status === "active" && <button disabled={saving} type="button" onClick={()=>save(null,"archived")} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Archive badge</button>}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
