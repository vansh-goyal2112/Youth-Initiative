"use client";

import Link from "next/link";

import {
  BookOpen,
  ChevronRight,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <main className="admin-dashboard-page">

      <div className="admin-page-heading">

        <div>
          <span>
            ADMIN PORTAL
          </span>

          <h1>
            Youth Initiative Dashboard
          </h1>

          <p>
            Manage students, workshops
            and workshop attendance.
          </p>
        </div>

      </div>


      <div className="admin-dashboard-grid">

        <AdminDashboardCard
          icon={Users}
          title="Student Management"
          description="View student accounts, progress, learning preferences and account status."
          href="/admin/students"
        />

        <AdminDashboardCard
          icon={BookOpen}
          title="Workshop Management"
          description="Import the client spreadsheet, create workshops and manage existing programs."
          href="/admin/workshops"
        />

        <AdminDashboardCard
          icon={QrCode}
          title="Attendance"
          description="Generate expiring QR codes for workshop attendance verification."
          href="/admin/attendance"
        />

      </div>


      <section className="admin-dashboard-security">

        <ShieldCheck size={27} />

        <div>
          <strong>
            Administrator Portal
          </strong>

          <p>
            Student authentication and
            administrator authentication
            are separated for the MVP.
          </p>
        </div>

      </section>

    </main>
  );
}


function AdminDashboardCard({
  icon: Icon,
  title,
  description,
  href,
}) {
  return (
    <Link
      href={href}
      className="admin-dashboard-card"
    >

      <div>
        <Icon size={27} />
      </div>

      <h2>
        {title}
      </h2>

      <p>
        {description}
      </p>

      <span>
        Open
        <ChevronRight size={16} />
      </span>

    </Link>
  );
}