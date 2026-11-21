"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight, ChevronRight, ClipboardList, GraduationCap, ShieldCheck,
  Sparkles, Users, UserRoundCheck, Activity,
} from "lucide-react";
import { adminFetch } from "@/services/adminApi";
import { adminWorkspaces } from "@/components/admin/adminWorkspaces";

const shortcuts = [
  { ...adminWorkspaces.redeem, detail: "Find a student and record an event reward.", tint: "amber" },
  { ...adminWorkspaces.attendance, detail: "Launch workshop check-ins and manage QR sessions.", tint: "violet" },
  { ...adminWorkspaces.claims, detail: "Review student-reported workshop completions.", tint: "emerald" },
  { ...adminWorkspaces.students, detail: "Find profiles and manage student access.", tint: "blue" },
  { ...adminWorkspaces.workshops, detail: "Manage workshops, publish sessions and import programs.", tint: "rose" },
  { ...adminWorkspaces.badges, detail: "Manage the badges students can earn.", tint: "violet" },
];

const attentionItems = [
  { ...adminWorkspaces.claims, id: "claims", label: "Claims waiting for review",
    endpoint: "/api/admin/completions?summary=1" },
  { id: "registrations", permission: adminWorkspaces.students.permission,
    label: "Pending registrations", href: "/admin/students#pending-registrations",
    endpoint: "/api/admin/students?pendingCount=1" },
];

function AttentionItem({ item }) {
  const [count, setCount] = useState(undefined);

  useEffect(() => {
    const request = new AbortController();
    adminFetch(item.endpoint, { signal: request.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Could not load count.");
        const result = await response.json();
        if (!request.signal.aborted) setCount(result.count);
      })
      .catch(() => { if (!request.signal.aborted) setCount(null); });
    return () => request.abort();
  }, [item.endpoint]);

  return (
    <Link href={item.href} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-amber-50">
      <span className="rounded-lg bg-amber-100 px-2 py-1 font-bold text-amber-900">
        {count === undefined ? <span aria-label="Loading count">…</span> :
          count === null ? <span aria-label="Count unavailable">—</span> : count.toLocaleString()}
      </span>
      {item.label}<ChevronRight size={16} aria-hidden="true" />
    </Link>
  );
}

function Metric({ label, value, description, icon: Icon, theme, loading }) {
  return <article className="admin-dashboard-metric">
    <div className="flex items-start justify-between gap-3"><span className="text-xs font-semibold tracking-wide text-slate-500">{label}</span><span className={`admin-dashboard-metric-icon ${theme}`}><Icon size={19}/></span></div>
    {loading ? <div className="mt-4 h-9 w-24 animate-pulse rounded-lg bg-slate-100"/> :
      <strong className="mt-3 block text-3xl font-extrabold tracking-[-0.055em] text-[#1c2b44]">{value}</strong>}
    <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
  </article>;
}

export default function AdminDashboardPage() {
  const [permissions, setPermissions] = useState([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [metrics, setMetrics] = useState({ students: "—", active: "—", workshops: "—", activeWorkshops: "—" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const update = () => {
      try {
        const session = JSON.parse(sessionStorage.getItem("adminSession") || "{}");
        setPermissions(Array.isArray(session.permissions) ? session.permissions : []);
        setAdminEmail(session.email || "");
      } catch { setPermissions([]); }
    };
    queueMicrotask(update);
    window.addEventListener("admin-session-updated", update);
    return () => window.removeEventListener("admin-session-updated", update);
  }, []);

  useEffect(() => {
    let live = true;
    Promise.allSettled([
      adminFetch("/api/admin/students").then(async r => r.ok ? (await r.json()).students : null),
      adminFetch("/api/admin/workshops").then(async r => r.ok ? (await r.json()).workshops : null),
    ]).then(([studentResult, workshopResult]) => {
      if (!live) return;
      const students = studentResult.status === "fulfilled" ? studentResult.value : null;
      const workshops = workshopResult.status === "fulfilled" ? workshopResult.value : null;
      setMetrics({
        students: Array.isArray(students) ? students.length.toLocaleString() : "—",
        active: Array.isArray(students) ? students.filter(s => s.accountStatus === "active").length.toLocaleString() : "—",
        workshops: Array.isArray(workshops) ? workshops.length.toLocaleString() : "—",
        activeWorkshops: Array.isArray(workshops) ? workshops.filter(w => w.status === "active").length.toLocaleString() : "—",
      });
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const allowed = shortcuts.filter(tool => permissions.includes(tool.permission));
  const attention = attentionItems.filter(item => permissions.includes(item.permission));
  const firstName = adminEmail.split("@")[0].split(/[._-]/)[0];
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "Administrator";

  return <main className="admin-dashboard mx-auto max-w-7xl px-4 py-7 md:px-9 md:py-9">
    {attention.length > 0 && (
      <section className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="needs-attention">
        <h2 id="needs-attention" className="text-lg font-extrabold text-amber-950">Needs attention</h2>
        {attention.map(item => <AttentionItem key={item.id} item={item} />)}
      </section>
    )}
    <div className="admin-dashboard-hero">
      <div className="admin-dashboard-hero-art" aria-hidden="true"><div/><div/><div/></div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-7">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.2em] text-orange-200"><Sparkles size={16}/> YOUR WORKSPACE</div>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-.045em] text-white md:text-[43px]">Welcome back, {displayName}<span className="text-[#ffad86]">.</span></h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">Everything you need to coordinate meaningful learning experiences, support students and move your program forward.</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200"><span className="h-2 w-2 rounded-full bg-emerald-400"/> Your secure administration workspace</div>
        </div>
      </div>
    </div>

    <section className="mt-8" aria-labelledby="staff-shortcuts">
      <h2 id="staff-shortcuts" className="mb-4 text-2xl font-extrabold text-[#1a2941]">Everyday shortcuts</h2>
      {allowed.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allowed.map(({ href, icon: Icon, label, detail, tint }) => (
            <Link key={href} href={href} className="admin-dashboard-module group">
              <div className="flex items-start justify-between">
                <span className={`admin-dashboard-metric-icon large ${tint}`}><Icon size={23} aria-hidden="true" /></span>
                <span className="admin-dashboard-module-arrow"><ArrowUpRight size={18} aria-hidden="true" /></span>
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-[#1b2a40]">{label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
            </Link>
          ))}
        </div>
      ) : <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Check the menu for the tools available to your role.</p>}
    </section>

    <div className="mt-9 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#e0523c]">PROGRAM PULSE</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1a2941]">At a glance</h2><p className="mt-1 text-sm text-slate-500">A live snapshot of the Youth Initiatives.</p></div>
      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500"><Activity size={14}/> Live program data</span>
    </div>
    <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Program metrics">
      <Metric label="Student profiles" value={metrics.students} icon={Users} theme="blue" loading={loading} description="Total profiles in the directory"/>
      <Metric label="Active students" value={metrics.active} icon={UserRoundCheck} theme="emerald" loading={loading} description="Student accounts currently enabled"/>
      <Metric label="Workshops" value={metrics.workshops} icon={GraduationCap} theme="violet" loading={loading} description="Experiences in the program catalog"/>
      <Metric label="Active workshops" value={metrics.activeWorkshops} icon={ClipboardList} theme="amber" loading={loading} description="Currently published workshop records"/>
    </section>
    <p className="mt-3 text-xs text-slate-500">A dash means information is unavailable or your role does not have access.</p>

    <div className="admin-dashboard-footer mt-9 flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><ShieldCheck size={17}/> Access is verified on every protected request.</span><Link href="/admin/security" className="inline-flex items-center gap-1.5 font-semibold">Manage account security <ArrowUpRight size={16}/></Link></div>
  </main>;
}
