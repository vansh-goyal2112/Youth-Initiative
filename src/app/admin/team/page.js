"use client";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, RefreshCw, Users, Save, Search, UserRoundCheck, Clock3, LockKeyhole, ChevronRight, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

const ROLES = ["viewer", "workshop_coordinator", "program_admin"];
const RIGHTS = [
  ["students.view", "View students"], ["students.edit", "Edit students"],
  ["students.deactivate", "Deactivate students"], ["reports.generate", "Generate student reports"],
  ["reports.export", "Export reports"], ["workshops.view", "View workshops"],
  ["workshops.create", "Create workshops"], ["workshops.edit", "Edit workshops"],
  ["workshops.delete", "Delete workshops"], ["workshops.import", "Import workshop Excel"],
  ["attendance.view", "View attendance"], ["attendance.manage", "Manage attendance"],
];
const labelRole = role => String(role || "unassigned").replaceAll("_", " ");

export default function AdminTeamPage() {
  const [admins, setAdmins] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/team");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not load administrators.");
      setAdmins(Array.isArray(result.admins) ? result.admins : []);
    } catch (err) { setError(err.message || "Staff records are unavailable."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let alive = true;
    adminFetch("/api/admin/team").then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not load administrators.");
      if (alive) setAdmins(Array.isArray(result.admins) ? result.admins : []);
    }).catch(err => { if (alive) setError(err.message || "Staff records are unavailable."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function selectAdmin(admin) {
    setSelectedId(admin.id);
    setDraft({ id: admin.id, adminRole: ROLES.includes(admin.adminRole) ? admin.adminRole : "viewer",
      status: admin.status, permissionOverrides: {...(admin.permissionOverrides || {})} });
    setSuccess("");
  }
  async function save() {
    if (!draft || !window.confirm("Update this employee's administrator access?")) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await adminFetch("/api/admin/team", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(draft) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Permission change failed.");
      setSuccess("Administrator access updated successfully.");
      await refresh();
    } catch(err) { setError(err.message || "Unable to save permissions."); }
    finally { setSaving(false); }
  }
  const selected = admins.find(admin => admin.id === selectedId);
  const filtered = useMemo(() => admins.filter(admin =>
    (filter === "all" || admin.status === filter) &&
    (!search.trim() || admin.email?.toLowerCase().includes(search.toLowerCase().trim()))), [admins,filter,search]);
  const pendingCount = admins.filter(admin => admin.status === "pending").length;
  const activeCount = admins.filter(admin => admin.status === "active").length;

  return <main className="admin-team-redesign mx-auto max-w-7xl px-4 py-8 md:px-8">
    <header className="admin-team-intro">
      <div><p className="admin-section-eyebrow"><ShieldCheck size={15}/> ACCESS GOVERNANCE</p><h1>People & permissions<span>.</span></h1><p>Review verified SAIT staff, approve access requests and manage responsibilities with confidence.</p></div>
      <button type="button" onClick={refresh} disabled={loading} className="admin-team-refresh"><RefreshCw size={18} className={loading ? "animate-spin" : ""}/> Refresh directory</button>
    </header>
    <div className="admin-team-stats">
      <div><span><Users size={21}/></span><div><strong>{admins.length}</strong><small>Total staff records</small></div></div>
      <div><span className="green"><UserRoundCheck size={21}/></span><div><strong>{activeCount}</strong><small>Active accounts</small></div></div>
      <div><span className="amber"><Clock3 size={21}/></span><div><strong>{pendingCount}</strong><small>Pending requests</small></div></div>
    </div>
    {error && <div className="admin-auth-alert error mb-5" role="alert"><ShieldCheck size={19}/>{error}</div>}
    {success && <div className="admin-auth-alert success mb-5" role="status"><CheckCircle2 size={19}/>{success}</div>}
    <div className="admin-team-grid">
      <section className="admin-team-directory">
        <div className="admin-team-panel-heading"><span className="admin-panel-icon"><Users size={22}/></span><div><h2>Staff directory</h2><p>Select someone to manage their access.</p></div></div>
        <div className="admin-team-search"><Search size={18}/><input aria-label="Search staff by email" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff email…"/></div>
        <div className="admin-team-filters" role="group" aria-label="Filter staff by status">
          {["all", "pending", "active", "inactive"].map(status => <button key={status} type="button" onClick={()=>setFilter(status)} className={filter === status ? "selected" : ""} aria-pressed={filter === status}>{status}</button>)}
        </div>
        <div className="admin-team-list">
          {loading ? <p className="admin-team-list-empty">Loading team records…</p> : filtered.length === 0 ? <p className="admin-team-list-empty">No matching staff accounts.</p> :
            filtered.map(admin => <button type="button" key={admin.id} className={`admin-team-person ${selectedId === admin.id ? "selected" : ""}`} onClick={() => selectAdmin(admin)}>
              <span className="admin-team-avatar">{(admin.email || "A").charAt(0).toUpperCase()}</span>
              <span className="admin-team-person-text"><strong>{admin.email}</strong><small>{labelRole(admin.adminRole)}</small></span>
              <span className={`admin-team-status ${admin.status}`}>{admin.status}</span><ChevronRight size={16} className="text-slate-400"/>
            </button>)}
        </div>
      </section>
      <section className="admin-team-editor">
        {!draft || !selected ? <div className="admin-team-editor-placeholder"><div><SlidersHorizontal size={34}/></div><h2>Manage access in one place.</h2><p>Select a staff member from the directory to review their role, account status and individual permissions.</p></div> :
        selected.adminRole === "super_admin" ? <div className="admin-team-editor-placeholder"><div><LockKeyhole size={34}/></div><h2>Protected Super Admin account</h2><p>This administrator’s privileges cannot be changed from the staff directory.</p></div> :
        <>
          <div className="admin-team-panel-heading"><span className="admin-panel-icon violet"><SlidersHorizontal size={22}/></span><div><h2>Employee access</h2><p>{selected.email}</p></div></div>
          <div className="admin-team-editor-fields">
            <label>Assigned role<select value={draft.adminRole} onChange={e=>setDraft({...draft,adminRole:e.target.value})}>{ROLES.map(role=><option key={role} value={role}>{labelRole(role)}</option>)}</select></label>
            <label>Account status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{["pending","active","rejected","inactive"].map(status=><option key={status} value={status}>{status}</option>)}</select></label>
          </div>
          <div className="admin-team-rights-heading"><h3>Individual permissions</h3><p>Inherit uses the default role. Override only when a specific team member needs different access.</p></div>
          <div className="admin-team-rights">{RIGHTS.map(([key,label])=><label key={key}><span>{label}</span><select aria-label={label} value={draft.permissionOverrides[key] === undefined ? "inherit" : draft.permissionOverrides[key] ? "allow" : "deny"}
            onChange={e=>{const permissionOverrides={...draft.permissionOverrides};if(e.target.value==="inherit")delete permissionOverrides[key];else permissionOverrides[key]=e.target.value==="allow";setDraft({...draft,permissionOverrides});}}>
            <option value="inherit">Inherit</option><option value="allow">Allow</option><option value="deny">Deny</option>
          </select></label>)}</div>
          <div className="admin-team-save-row"><p><ShieldCheck size={16}/> Permission changes require confirmation.</p><button disabled={saving} onClick={save} type="button"><Save size={18}/>{saving?"Saving changes…":"Save changes"}</button></div>
        </>}
      </section>
    </div>
  </main>;
}
