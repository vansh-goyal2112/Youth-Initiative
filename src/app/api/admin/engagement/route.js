import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { queryCosmosDocuments } from "@/services/cosmosData";
import { recordAdminAudit } from "@/services/adminAudit";
import { periodBounds, summarize } from "@/services/engagementAnalytics.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    if (format === "csv") await requireAdminPermission(request, "reports.export");
    const {start,end} = periodBounds(period,anchor);
    const today = new Date().toISOString().slice(0,10);
    const workshops = await queryCosmosDocuments("workshops",
      "SELECT c.id, c.title, c.programArea, c.startDate, c.endDate, c.capacity FROM c WHERE (c.startDate >= @start AND c.startDate < @end) OR (c.endDate >= @start AND c.endDate < @end)",
      [{name:"@start",value:start},{name:"@end",value:end}]);
    const eligibleIds = workshops.filter(w => {
      const date = String(w.endDate || w.startDate || "").slice(0,10);
      return date >= start && date < end && date <= today;
    }).map(w=>w.id);
    // Query only the workshops in the selected reporting period.
    const registrations = eligibleIds.length
      ? await queryCosmosDocuments("registrations",
          "SELECT c.workshopId, c.studentId, c.attendanceStatus, c.status FROM c WHERE ARRAY_CONTAINS(@ids, c.workshopId) AND IS_DEFINED(c.studentId)",
          [{name:"@ids",value:eligibleIds}])
      : [];
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
