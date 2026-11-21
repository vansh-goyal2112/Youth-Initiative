import { BookOpen, ClipboardList, Gift, QrCode, ShieldCheck, Users } from "lucide-react";

export const adminWorkspaces = {
  redeem: { href: "/admin/redeem-xp", label: "Redeem XP", icon: Gift, permission: "xp.redeem" },
  attendance: { href: "/admin/attendance", label: "Attendance", icon: QrCode, permission: "attendance.manage" },
  claims: { href: "/admin/completions", label: "Review claims", icon: ClipboardList, permission: "completion.review" },
  students: { href: "/admin/students", label: "Student directory", icon: Users, permission: "students.view" },
  workshops: { href: "/admin/workshops", label: "Workshop studio", icon: BookOpen, permission: "workshops.view" },
  badges: { href: "/admin/badges", label: "Badges", icon: ShieldCheck, permission: "badges.manage" },
};
