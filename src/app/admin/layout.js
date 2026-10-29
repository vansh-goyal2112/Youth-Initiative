"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  QrCode,
  Users,
  ShieldCheck,
  FileText,
  ClipboardList,
  KeyRound,
} from "lucide-react";

import {
  signOut,
} from "firebase/auth";

import {
  auth,
} from "@/services/firebase";

import AdminGuard from "@/components/admin/AdminGuard";

export default function AdminLayout({
  children,
}) {
  const pathname =
    usePathname();

  const router = useRouter();
  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    function updatePermissions() {
      try {
        const session = JSON.parse(sessionStorage.getItem("adminSession") || "{}");
        setPermissions(Array.isArray(session.permissions) ? session.permissions : []);
      } catch {
        setPermissions([]);
      }
    }
    queueMicrotask(updatePermissions);
    window.addEventListener("admin-session-updated", updatePermissions);
    return () => window.removeEventListener("admin-session-updated", updatePermissions);
  }, []);

  const can = (right) => permissions.includes(right);

  async function logoutAdmin() {
    await signOut(auth);

    sessionStorage.removeItem(
      "adminSession"
    );

    router.replace(
      "/admin/login"
    );
  }

  if (
    pathname === "/admin/login"
  ) {
    return (
      <AdminGuard>
        {children}
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>

      <div className="admin-shell">

        <aside className="admin-sidebar">

          <div className="admin-sidebar-brand">
            <strong>
              SAIT
            </strong>

            <span>
              Youth Initiative
            </span>

            <small>
              ADMIN PORTAL
            </small>
          </div>


          <nav className="admin-sidebar-nav">

            <AdminNavLink
              href="/admin"
              pathname={pathname}
              icon={LayoutDashboard}
              label="Dashboard"
            />

            {can("students.view") && (
            <AdminNavLink
              href="/admin/students"
              pathname={pathname}
              icon={Users}
              label="Students"
            />
            )}

            {can("workshops.view") && (
            <AdminNavLink
              href="/admin/workshops"
              pathname={pathname}
              icon={BookOpen}
              label="Workshops"
            />
            )}

            {can("reports.generate") && (
            <AdminNavLink
              href="/admin/reports"
              pathname={pathname}
              icon={FileText}
              label="Student Reports"
            />
            )}

            {can("admins.view") && (
            <AdminNavLink
              href="/admin/team"
              pathname={pathname}
              icon={ShieldCheck}
              label="Team & Permissions"
            />
            )}

            {can("audit.view") && (
            <AdminNavLink
              href="/admin/audit"
              pathname={pathname}
              icon={ClipboardList}
              label="Activity & Audit"
            />
            )}

            {can("attendance.manage") && (
            <AdminNavLink
              href="/admin/attendance"
              pathname={pathname}
              icon={QrCode}
              label="Attendance"
            />
            )}

            <AdminNavLink
              href="/admin/security"
              pathname={pathname}
              icon={KeyRound}
              label="Account Security"
            />

          </nav>


          <button
            type="button"
            className="admin-sidebar-logout"
            onClick={logoutAdmin}
          >
            <LogOut size={18} />
            Log Out
          </button>

        </aside>


        <div className="admin-content-shell">
          {children}
        </div>

      </div>

    </AdminGuard>
  );
}


function AdminNavLink({
  href,
  pathname,
  icon: Icon,
  label,
}) {
  const active =
    href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(
          href
        );

  return (
    <Link
      href={href}
      className={
        active
          ? "active"
          : ""
      }
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}