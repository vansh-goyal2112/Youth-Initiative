"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, Users, Save } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

const ROLES = ["viewer", "workshop_coordinator", "program_admin"];
const RIGHTS = [
  ["students.view", "View students"], ["students.edit", "Edit students"],
  ["students.deactivate", "Deactivate students"],
  ["reports.generate", "Generate student reports"], ["reports.export", "Export reports"],
  ["workshops.view", "View workshops"], ["workshops.create", "Create workshops"],
  ["workshops.edit", "Edit workshops"], ["workshops.delete", "Delete workshops"],
  ["workshops.import", "Import workshop Excel"],
  ["attendance.view", "View attendance"], ["attendance.manage", "Manage attendance"],
];

export default function AdminTeamPage() {
  const [admins, setAdmins] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/team");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not load administrators.");
      setAdmins(result.admins || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    adminFetch("/api/admin/team")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Could not load administrators.");
        if (active) setAdmins(result.admins || []);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function selectAdmin(admin) {
    setSelectedId(admin.id);
    setDraft({
      id: admin.id,
      adminRole: ROLES.includes(admin.adminRole) ? admin.adminRole : "viewer",
      status: admin.status,
      permissionOverrides: { ...(admin.permissionOverrides || {}) },
    });
    setSuccess("");
  }
  async function save() {
    if (!draft || !window.confirm("Update this employee's administrator access?")) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await adminFetch("/api/admin/team", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Permission change failed.");
      setSuccess("Administrator changes saved to Cosmos DB.");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  const selected = admins.find((admin) => admin.id === selectedId);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Access Governance</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Team & Permissions</h1>
          <p className="mt-2 text-sm text-slate-600">Review access requests and customize permissions for individual SAIT employees.</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700" type="button"><RefreshCw size={17}/> Refresh</button>
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{success}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(270px,1fr)_minmax(360px,1.3fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Users size={21} className="text-orange-600"/><h2 className="font-bold text-slate-900">Staff directory</h2></div>
          {loading ? <p className="text-slate-500">Loading authorized records…</p> : admins.length === 0 ? <p className="text-slate-500">No requests or administrators found.</p> :
            <div className="space-y-2">{admins.map((admin) =>
              <button type="button" key={admin.id} onClick={() => selectAdmin(admin)} className={`block w-full rounded-xl border p-4 text-left transition hover:border-orange-300 ${selectedId === admin.id ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white"}`}>
                <span className="block break-all text-sm font-bold text-slate-900">{admin.email}</span>
                <span className="mt-1 block text-xs capitalize text-slate-600">{admin.adminRole?.replaceAll("_", " ")} · {admin.status}</span>
              </button>)}</div>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {!draft || !selected ? <div className="flex min-h-72 flex-col items-center justify-center text-center text-slate-500"><ShieldCheck size={44}/><p className="mt-4">Select an employee to review access.</p></div> :
          selected.adminRole === "super_admin" ? <p className="rounded-lg bg-slate-50 p-5 text-slate-700">Super Admin privileges are protected and cannot be edited here.</p> :
          <>
            <h2 className="text-xl font-bold text-slate-900">Employee access</h2>
            <p className="mb-5 mt-1 break-all text-sm text-slate-500">{selected.email}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Role
                <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3" value={draft.adminRole} onChange={(e) => setDraft({...draft, adminRole: e.target.value})}>{ROLES.map(role=><option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Account status
                <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3" value={draft.status} onChange={(e) => setDraft({...draft, status: e.target.value})}>{["pending", "active", "rejected", "inactive"].map(status=><option key={status}>{status}</option>)}</select>
              </label>
            </div>
            <h3 className="mt-7 font-bold text-slate-900">Individual permissions</h3>
            <p className="mt-1 text-xs text-slate-500">Inherit uses the role default. Allow or deny overrides that permission for this employee only.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">{RIGHTS.map(([key,label]) =>
              <label key={key} className="flex flex-col gap-1 rounded-xl border border-slate-100 p-3 text-sm">
                <span className="font-medium text-slate-700">{label}</span>
                <select aria-label={label} className="rounded-lg border border-slate-200 bg-white p-2" value={draft.permissionOverrides[key] === undefined ? "inherit" : draft.permissionOverrides[key] ? "allow" : "deny"} onChange={(e)=>{
                  const permissionOverrides={...draft.permissionOverrides};
                  if(e.target.value==="inherit") delete permissionOverrides[key];
                  else permissionOverrides[key]=e.target.value==="allow";
                  setDraft({...draft,permissionOverrides});
                }}>
                  <option value="inherit">Inherit role default</option><option value="allow">Allow</option><option value="deny">Deny</option>
                </select>
              </label>)}</div>
            <button disabled={saving} onClick={save} type="button" className="mt-6 flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white disabled:opacity-50"><Save size={18}/>{saving ? "Saving..." : "Save permissions"}</button>
          </>}
        </section>
      </div>
    </main>
  );
}
