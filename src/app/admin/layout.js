"use client";
import "./admin-design.css";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  BookOpen, LayoutDashboard, LogOut, QrCode, Users, ShieldCheck,
  FileText, ClipboardList, KeyRound, Menu, X, ChevronRight, PanelLeftClose, BarChart3,
} from "lucide-react";
import { auth } from "@/services/firebase";
import AdminGuard from "@/components/admin/AdminGuard";

const navigation = [
  { title: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  { title: "Operations", items: [
    { href: "/admin/students", label: "Students", icon: Users, permission: "students.view" },
    { href: "/admin/workshops", label: "Workshops", icon: BookOpen, permission: "workshops.view" },
    { href: "/admin/attendance", label: "Attendance", icon: QrCode, permission: "attendance.manage" },
    { href: "/admin/reports", label: "Student reports", icon: FileText, permission: "reports.generate" },
    { href: "/admin/engagement", label: "Engagement insights", icon: BarChart3, permission: "attendance.view" },
  ] },
  { title: "Administration", items: [
    { href: "/admin/team", label: "Team & access", icon: ShieldCheck, permission: "admins.view" },
    { href: "/admin/audit", label: "Audit activity", icon: ClipboardList, permission: "audit.view" },
    { href: "/admin/security", label: "Account security", icon: KeyRound },
  ] },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const sync = () => {
      try { setSession(JSON.parse(sessionStorage.getItem("adminSession") || "{}")); }
      catch { setSession({}); }
    };
    queueMicrotask(sync);
    window.addEventListener("admin-session-updated", sync);
    return () => window.removeEventListener("admin-session-updated", sync);
  }, []);

  useEffect(() => { queueMicrotask(() => setMobileOpen(false)); }, [pathname]);

  async function logoutAdmin() {
    try { await fetch("/api/admin/mfa/logout", { method: "POST" }); } catch { /* Firebase sign-out still proceeds. */ }
    await signOut(auth);
    sessionStorage.removeItem("adminSession");
    router.replace("/admin/login");
  }

  if (pathname === "/admin/login") return <AdminGuard>{children}</AdminGuard>;

  const permissions = Array.isArray(session.permissions) ? session.permissions : [];
  const currentItem = navigation.flatMap(group => group.items).find(item =>
    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href));
  const role = String(session.adminRole || session.role || "Team member").replaceAll("_", " ");
  const email = session.email || "Authorized administrator";

  const sidebar = <div className="admin-app-sidebar-inner flex h-full flex-col">
    <div className="flex min-h-24 items-center justify-between border-b border-white/10 px-5">
      <Link href="/admin" className="flex min-w-0 items-center gap-3" aria-label="Youth Initiative admin home">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e83a2d] text-lg font-black tracking-tight text-white shadow-lg shadow-red-950/30">S</span>
        {!collapsed && <span className="min-w-0"><strong className="block text-base font-extrabold tracking-tight text-white">Youth Initiative</strong><small className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Administration</small></span>}
      </Link>
      <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" aria-label="Close menu"><X size={20}/></button>
      <button type="button" onClick={() => setCollapsed(v => !v)} className="hidden rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:block" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}><PanelLeftClose size={19}/></button>
    </div>
    <nav className="admin-app-navigation flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Admin navigation">
      {navigation.map(group => {
        const items = group.items.filter(item => !item.permission || permissions.includes(item.permission));
        if (!items.length) return null;
        return <div key={group.title}>
          {!collapsed && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{group.title}</p>}
          <div className="space-y-1">
            {items.map(({ href, label, icon: Icon }) => {
              const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
              return <Link key={href} href={href} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined}
                className={`admin-app-nav-link group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${active ? "is-active bg-[#e83a2d] text-white shadow-md shadow-red-950/20" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
                <Icon size={19} className="shrink-0"/>{!collapsed && <><span className="flex-1">{label}</span>{active && <ChevronRight size={15} className="opacity-75"/>}</>}
              </Link>;
            })}
          </div>
        </div>;
      })}
    </nav>
    <div className="border-t border-white/10 p-3">
      <div className={`mb-2 flex items-center gap-3 rounded-xl bg-white/5 p-3 ${collapsed ? "justify-center" : ""}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-400/20 text-sm font-extrabold uppercase text-orange-200">{email.charAt(0)}</div>
        {!collapsed && <div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{email}</p><p className="mt-0.5 text-xs capitalize text-slate-400">{role}</p></div>}
      </div>
      <button type="button" onClick={logoutAdmin} title="Log out" className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-red-500/15 hover:text-red-200 ${collapsed ? "justify-center" : ""}`}><LogOut size={19}/>{!collapsed && "Log out"}</button>
    </div>
  </div>;

  return <AdminGuard>
    <div className="admin-revamp min-h-screen bg-[#f5f6fa] text-slate-900 lg:flex">
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-slate-950/65 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay"/>}
      <aside className={`admin-app-sidebar fixed inset-y-0 left-0 z-50 w-[280px] bg-[#141d30] shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 lg:shadow-none ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[80px]" : "lg:w-[260px]"}`}>{sidebar}</aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl border border-slate-200 p-2.5 text-slate-700 lg:hidden" aria-label="Open navigation"><Menu size={21}/></button>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.19em] text-slate-400">Administration / Youth Initiative</p><p className="mt-0.5 truncate text-base font-bold text-slate-900">{currentItem?.label || "Admin workspace"}</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500"/>Secure workspace</div>
        </header>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  </AdminGuard>;
}
