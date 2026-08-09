"use client";

import Link from "next/link";
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

  const router =
    useRouter();

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

            <AdminNavLink
              href="/admin/students"
              pathname={pathname}
              icon={Users}
              label="Students"
            />

            <AdminNavLink
              href="/admin/workshops"
              pathname={pathname}
              icon={BookOpen}
              label="Workshops"
            />

            <AdminNavLink
              href="/admin/attendance"
              pathname={pathname}
              icon={QrCode}
              label="Attendance"
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