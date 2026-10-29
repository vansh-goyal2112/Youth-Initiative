"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight, BookOpen, CalendarCheck2, ChevronRight, ClipboardList,
  FileText, GraduationCap, ShieldCheck, Sparkles, Users, UserRoundCheck,
  Activity, ArrowRight, Zap, LockKeyhole, BarChart3,
} from "lucide-react";
import { adminFetch } from "@/services/adminApi";

const toolGroups = [
  { href: "/admin/students", right: "students.view", icon: Users, title: "Student directory", detail: "Find profiles, review journeys and manage student access.", caption: "PEOPLE", tint: "blue" },
  { href: "/admin/workshops", right: "workshops.view", icon: BookOpen, title: "Workshop studio", detail: "Plan engaging experiences, publish sessions and import programs.", caption: "PROGRAMS", tint: "rose" },
  { href: "/admin/attendance", right: "attendance.manage", icon: CalendarCheck2, title: "Live attendance", detail: "Launch check-ins and manage workshop QR sessions.", caption: "ENGAGEMENT", tint: "violet" },
  { href: "/admin/reports", right: "reports.generate", icon: FileText, title: "Student intelligence", detail: "Explore progress, export insights and measure participation.", caption: "INSIGHTS", tint: "emerald" },
  { href: "/admin/team", right: "admins.view", icon: ShieldCheck, title: "Team & permissions", detail: "Review requests, assign access and protect program data.", caption: "GOVERNANCE", tint: "amber" },
  { href: "/admin/audit", right: "audit.view", icon: Activity, title: "Audit activity", detail: "Review administrative actions and accountability records.", caption: "SECURITY", tint: "slate" },
];

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

  const allowed = toolGroups.filter(tool => permissions.includes(tool.right));
  const firstName = adminEmail.split("@")[0].split(/[._-]/)[0];
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "Administrator";

  return <main className="admin-dashboard mx-auto max-w-7xl px-4 py-7 md:px-9 md:py-9">
    <div className="admin-dashboard-hero">
      <div className="admin-dashboard-hero-art" aria-hidden="true"><div/><div/><div/></div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-7">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.2em] text-orange-200"><Sparkles size={16}/> YOUR WORKSPACE</div>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-.045em] text-white md:text-[43px]">Welcome back, {displayName}<span className="text-[#ffad86]">.</span></h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">Everything you need to coordinate meaningful learning experiences, support students and move your program forward.</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200"><span className="h-2 w-2 rounded-full bg-emerald-400"/> Your secure administration workspace</div>
        </div>
        <div className="flex flex-wrap gap-3">
          {permissions.includes("reports.generate") && <Link href="/admin/reports" className="admin-dashboard-primary"><FileText size={17}/> Generate report <ArrowUpRight size={17}/></Link>}
          {permissions.includes("workshops.create") && <Link href="/admin/workshops" className="admin-dashboard-ghost"><Zap size={17}/> Manage workshops <ArrowRight size={17}/></Link>}
        </div>
      </div>
    </div>

    <div className="mt-9 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#e0523c]">PROGRAM PULSE</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1a2941]">At a glance</h2><p className="mt-1 text-sm text-slate-500">A live snapshot of the Youth Initiative.</p></div>
      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500"><Activity size={14}/> Live program data</span>
    </div>
    <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Program metrics">
      <Metric label="Student profiles" value={metrics.students} icon={Users} theme="blue" loading={loading} description="Total profiles in the directory"/>
      <Metric label="Active students" value={metrics.active} icon={UserRoundCheck} theme="emerald" loading={loading} description="Student accounts currently enabled"/>
      <Metric label="Workshops" value={metrics.workshops} icon={GraduationCap} theme="violet" loading={loading} description="Experiences in the program catalog"/>
      <Metric label="Active workshops" value={metrics.activeWorkshops} icon={ClipboardList} theme="amber" loading={loading} description="Currently published workshop records"/>
    </section>
    <p className="mt-3 text-xs text-slate-500">A dash means information is unavailable or your role does not have access.</p>

    <section className="mt-10" aria-label="Management tools">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#e0523c]">YOUR TOOLS</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1a2941]">What would you like to do?</h2><p className="mt-1 text-sm text-slate-500">Choose a workspace to get started.</p></div><span className="text-xs font-semibold text-slate-500">{allowed.length} available modules</span></div>
      {allowed.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {allowed.map(({ href, icon: Icon, title, detail, caption, tint }) =>
          <Link key={href} href={href} className="admin-dashboard-module group">
            <div className="flex items-start justify-between"><span className={`admin-dashboard-metric-icon large ${tint}`}><Icon size={23}/></span><span className="admin-dashboard-module-arrow"><ArrowUpRight size={18}/></span></div>
            <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">{caption}</p>
            <h3 className="mt-2 text-lg font-extrabold tracking-tight text-[#1b2a40]">{title}</h3>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{detail}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#dc4e3a]">Open workspace <ChevronRight size={15}/></span>
          </Link>
        )}
      </div> : <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-7 text-slate-600"><LockKeyhole size={22} className="shrink-0 text-slate-400"/><p className="text-sm leading-6">Your administrator account has no assigned management modules. Contact your Super Admin to request access.</p></div>}
    </section>
    <div className="admin-dashboard-footer mt-9 flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><ShieldCheck size={17}/> Access is verified on every protected request.</span><Link href="/admin/security" className="inline-flex items-center gap-1.5 font-semibold">Manage account security <ArrowUpRight size={16}/></Link></div>
  </main>;
}
