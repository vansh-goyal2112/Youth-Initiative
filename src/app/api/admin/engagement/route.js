import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { queryCosmosDocuments } from "@/services/cosmosData";
import { recordAdminAudit } from "@/services/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function periodBounds(period, anchor) {
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  if (period === "weekly") {
    const day = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - day);
  } else if (period === "monthly") start.setUTCDate(1);
  else { start.setUTCMonth(0); start.setUTCDate(1); }
  const end = new Date(start);
  if (period === "weekly") end.setUTCDate(end.getUTCDate() + 7);
  else if (period === "monthly") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function isVerified(registration) {
  return registration.attendanceStatus === "verified" && registration.status === "completed";
}

function summarize(workshops, registrations, start, end, now) {
  const eligible = workshops.filter(w => {
    const date = String(w.endDate || w.startDate || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= start && date < end && date <= now;
  });
  const bucket = new Map(eligible.map(w => [w.id, {
    workshopId: w.id, title: w.title || "Untitled workshop", programArea: w.programArea || "Uncategorized",
    date: String(w.endDate || w.startDate).slice(0,10), capacity: Number.isFinite(Number(w.capacity)) && Number(w.capacity) > 0 ? Number(w.capacity) : null,
    registrations: new Set(), attendees: new Set(),
  }]));
  for (const r of registrations) {
    const row = bucket.get(r.workshopId);
    if (!row || !r.studentId) continue;
    row.registrations.add(r.studentId);
    if (isVerified(r)) row.attendees.add(r.studentId);
  }
  const rows = [...bucket.values()].map(w => ({
    workshopId: w.workshopId, title: w.title, programArea: w.programArea, date: w.date,
    registered: w.registrations.size, attended: w.attendees.size,
    absent: Math.max(0, w.registrations.size - w.attendees.size),
    attendanceRate: w.registrations.size ? Math.round(100 * w.attendees.size / w.registrations.size) : 0,
    capacity: w.capacity,
  })).sort((a,b) => b.attended - a.attended || b.registered - a.registered || a.title.localeCompare(b.title));
  const totalAttended = rows.reduce((sum,row) => sum + row.attended,0);
  const totalRegistered = rows.reduce((sum,row) => sum + row.registered,0);
  return {
    workshops: rows,
    summary: {
      workshopsHeld: rows.length, verifiedAttendance: totalAttended, registrations: totalRegistered,
      attendanceRate: totalRegistered ? Math.round(100*totalAttended/totalRegistered) : 0,
      topWorkshop: rows[0] || null,
    },
  };
}
export async function GET(request) {
  try {
    const admin = await requireAdminPermission(request, "attendance.view");
    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "monthly";
    const dateText = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const format = url.searchParams.get("format") || "json";
    const anchor = new Date(dateText + "T00:00:00Z");
    if (!["weekly","monthly","yearly"].includes(period) || !/^\d{4}-\d{2}-\d{2}$/.test(dateText) ||
        !Number.isFinite(anchor.getTime()) || anchor.toISOString().slice(0,10) !== dateText ||
        !["json","csv"].includes(format)) {
      return Response.json({ message:"Invalid reporting period, date, or export format." }, { status:400 });
    }
    await requireAdminPermission(request, "reports.generate");
    if (format === "csv") await requireAdminPermission(request, "reports.export");
    const {start,end} = periodBounds(period,anchor);
    const today = new Date().toISOString().slice(0,10);
    const [workshops,registrations] = await Promise.all([
      queryCosmosDocuments("workshops",
        "SELECT c.id, c.title, c.programArea, c.startDate, c.endDate, c.capacity FROM c WHERE (c.startDate >= @start AND c.startDate < @end) OR (c.endDate >= @start AND c.endDate < @end)",
        [{name:"@start",value:start},{name:"@end",value:end}]),
      queryCosmosDocuments("registrations",
        "SELECT c.workshopId, c.studentId, c.attendanceStatus, c.status FROM c WHERE IS_DEFINED(c.workshopId) AND IS_DEFINED(c.studentId)"),
    ]);
    const result = summarize(workshops,registrations,start,end,today);
    await recordAdminAudit({actorUid:admin.uid,action:format==="csv"?"reports.export":"reports.generate",resource:"/api/admin/engagement"});
    if (format==="csv") {
      const quote = value => {
        const s = String(value ?? "").replace(/[\r\n]/g," ");
        const safe = /^[\s]*[=+@-]/.test(s) ? "'" + s : s;
        return '"' + safe.replace(/"/g,'""') + '"';
      };
      const data = [["Workshop","Program area","Date","Registered","Verified attendance","Not verified","Attendance rate (%)"],
        ...result.workshops.map(w=>[w.title,w.programArea,w.date,w.registered,w.attended,w.absent,w.attendanceRate])];
      return new Response(data.map(row=>row.map(quote).join(",")).join("\r\n"), {
        headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="workshop-engagement.csv"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"},
      });
    }
    return Response.json({success:true,period,start,end,generatedAt:new Date().toISOString(),...result}, {headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {
    const access = adminAccessResponse(error);
    if (access) return access;
    console.error("Engagement report error:",error?.message);
    return Response.json({message:"Engagement report could not be generated."},{status:500});
  }
}
