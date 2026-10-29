"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight, BookOpen, CalendarCheck2, ChartNoAxesCombined,
  ChevronRight, ClipboardList, FileText, GraduationCap,
  ShieldCheck, Sparkles, Users, UserRoundCheck,
} from "lucide-react";
import { adminFetch } from "@/services/adminApi";

const links = [
  { href: "/admin/students", icon: Users, title: "Students", description: "Search Youth IDs, manage student profiles, and review participation.", tag: "Student records" },
  { href: "/admin/workshops", icon: BookOpen, title: "Workshops", description: "Create workshops, update schedules, and import spreadsheets.", tag: "Program operations" },
  { href: "/admin/attendance", icon: CalendarCheck2, title: "Attendance", description: "Manage attendance sessions and workshop QR verification.", tag: "On-site delivery" },
  { href: "/admin/reports", icon: FileText, title: "Student Reports", description: "Generate access-controlled progress and participation reports.", tag: "Reporting" },
  { href: "/admin/team", icon: ShieldCheck, title: "Team & Permissions", description: "Approve staff requests and customize individual access.", tag: "Security" },
];

function Metric({ icon: Icon, label, value, description }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{label}</span><Icon size={20} className="text-orange-600"/></div>
    <strong className="mt-3 block text-3xl font-bold tracking-tight text-slate-900">{value}</strong>
    <p className="mt-2 text-xs text-slate-500">{description}</p>
  </article>;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState({ students: "—", active: "—", workshops: "—", activeWorkshops: "—" });

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      adminFetch("/api/admin/students").then(async r => r.ok ? (await r.json()).students : null),
      adminFetch("/api/admin/workshops").then(async r => r.ok ? (await r.json()).workshops : null),
    ]).then(([studentsResult, workshopsResult]) => {
      if (!active) return;
      const students = studentsResult.status === "fulfilled" ? studentsResult.value : null;
      const workshops = workshopsResult.status === "fulfilled" ? workshopsResult.value : null;
      setMetrics({
        students: Array.isArray(students) ? students.length.toLocaleString() : "—",
        active: Array.isArray(students) ? students.filter(s => s.accountStatus === "active").length.toLocaleString() : "—",
        workshops: Array.isArray(workshops) ? workshops.length.toLocaleString() : "—",
        activeWorkshops: Array.isArray(workshops) ? workshops.filter(w => w.status === "active").length.toLocaleString() : "—",
      });
    });
    return () => { active = false; };
  }, []);

  return <main className="mx-auto max-w-7xl px-4 py-7 md:px-9 md:py-10">
    <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-7 text-white shadow-xl md:p-10">
      <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" aria-hidden="true"/>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-orange-300"><Sparkles size={16}/> SAIT YOUTH INITIATIVE</div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Program command centre</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">Manage youth learning experiences, support student progress, and oversee your program with confidence.</p>
        </div>
        <Link className="relative z-10 flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-orange-400" href="/admin/reports"><FileText size={17}/> Student reports <ArrowUpRight size={16}/></Link>
      </div>
    </div>

    <section className="mt-8" aria-label="Program overview">
      <div className="mb-4 flex items-center gap-2"><ChartNoAxesCombined size={21} className="text-orange-600"/><h2 className="text-xl font-bold text-slate-900">At a glance</h2></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Student profiles" value={metrics.students} description="Accounts in Youth Initiative"/>
        <Metric icon={UserRoundCheck} label="Active students" value={metrics.active} description="Currently enabled accounts"/>
        <Metric icon={GraduationCap} label="Workshops" value={metrics.workshops} description="Programs in the catalog"/>
        <Metric icon={ClipboardList} label="Active workshops" value={metrics.activeWorkshops} description="Published workshop records"/>
      </div>
      <p className="mt-3 text-xs text-slate-500">A dash means your current permissions do not allow this data or it could not be loaded.</p>
    </section>

    <section className="mt-9">
      <div className="mb-4"><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Your workspace</p><h2 className="mt-1 text-xl font-bold text-slate-900">Management tools</h2></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map(({href,icon:Icon,title,description,tag})=>
          <Link href={href} key={href} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg">
            <div className="flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Icon size={23}/></span><ChevronRight size={19} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-orange-600"/></div>
            <span className="mt-5 block text-xs font-bold uppercase tracking-wide text-orange-600">{tag}</span>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </Link>)}
      </div>
    </section>
    <p className="mt-8 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={16}/> Access is verified by the server for every protected operation.</p>
  </main>;
}
