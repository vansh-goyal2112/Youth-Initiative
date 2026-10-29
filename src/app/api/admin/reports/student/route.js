import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { recordAdminAudit } from "@/services/adminAudit";
import { queryCosmosDocuments, readCosmosDocument } from "@/services/cosmosData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeCell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  // Protect users opening a spreadsheet against formula injection.
  return /^[\s]*[=+@\-]/.test(text) ? "'" + text : text;
}

function csvRow(values) {
  return values.map((value) => '"' + safeCell(value).replace(/"/g, '""') + '"').join(",");
}

export async function GET(request) {
  try {
    const admin = await requireAdminPermission(request, "reports.generate");
    const url = new URL(request.url);
    const youthId = (url.searchParams.get("youthId") || "").trim();
    const format = url.searchParams.get("format") || "json";
    if (!youthId || youthId.length > 80 || !["json", "csv"].includes(format)) {
      return Response.json({ message: "A valid Youth ID and report format are required." }, { status: 400 });
    }
    if (format === "csv") {
      await requireAdminPermission(request, "reports.export");
    }
    // Report access is sensitive even though it uses an HTTP GET.
    await recordAdminAudit({ actorUid: admin.uid, action: format === "csv" ? "reports.export" : "reports.generate", resource: "/api/admin/reports/student" });
    const matches = await queryCosmosDocuments("students",
      "SELECT * FROM c WHERE c.youthId = @youthId",
      [{ name: "@youthId", value: youthId }]);
    if (matches.length !== 1 || (matches[0].role && matches[0].role !== "student")) {
      return Response.json({ message: "Student not found." }, { status: 404 });
    }
    const student = matches[0];
    const studentId = student.id;
    const [registrations, badges, transactions] = await Promise.all([
      queryCosmosDocuments("registrations", "SELECT * FROM c WHERE c.studentId = @studentId",
        [{ name: "@studentId", value: studentId }]),
      queryCosmosDocuments("studentBadges", "SELECT * FROM c WHERE c.studentId = @studentId",
        [{ name: "@studentId", value: studentId }]),
      queryCosmosDocuments("xpTransactions", "SELECT * FROM c WHERE c.studentId = @studentId",
        [{ name: "@studentId", value: studentId }]),
    ]);
    const workshopIds = [...new Set(registrations.map((r) => r.workshopId).filter(Boolean))];
    const workshopDocs = await Promise.all(workshopIds.map((id) => readCosmosDocument("workshops", id)));
    const workshopMap = new Map(workshopDocs.filter(Boolean).map((w) => [w.id, w]));
    const report = {
      reportVersion: 1,
      generatedAt: new Date().toISOString(),
      generatedBy: admin.uid,
      student: {
        youthId: student.youthId,
        firstName: student.firstName || "",
        lastName: student.lastName || "",
        email: student.contactEmail || "",
        dateOfBirth: student.dateOfBirth || null,
        accountStatus: student.accountStatus || null,
        learningMode: student.learningMode || null,
        interests: student.interests || [],
        createdAt: student.createdAt || null,
        totalXp: student.totalXp ?? 0,
        level: student.level ?? 1,
        grade: student.grade || null,
        activeQuestId: student.activeQuestId || null,
      },
      registrations: registrations.map((item) => ({
        workshopId: item.workshopId,
        workshopTitle: workshopMap.get(item.workshopId)?.title || "Workshop unavailable",
        programArea: workshopMap.get(item.workshopId)?.programArea || null,
        status: item.status || null,
        attendanceStatus: item.attendanceStatus || null,
        registeredAt: item.createdAt || null,
        completedAt: item.completedAt || null,
        completionXpAwarded: item.completionXpAwarded ?? false,
      })),
      journey: {
        totalRegistrations: registrations.length,
        completedWorkshops: registrations.filter((r) => r.status === "completed").length,
        verifiedAttendance: registrations.filter((r) => r.attendanceStatus === "verified").length,
        upcomingRegistrations: registrations.filter((r) => r.status === "upcoming").length,
        skillAreasExplored: [...new Set(registrations.filter((r) => r.status === "completed").map((r) => workshopMap.get(r.workshopId)?.programArea).filter(Boolean))],
      },
      xpHistory: transactions.map((item) => ({
        workshopId: item.workshopId || null,
        status: item.status || null,
        amount: item.amount ?? item.xpAmount ?? null,
        createdAt: item.createdAt || null,
        completedAt: item.completedAt || null,
      })),
      badges: badges.map((item) => ({
        badgeId: item.badgeId || null,
        badgeName: item.name || item.title || null,
        awardedAt: item.awardedAt || item.createdAt || null,
      })),
    };
    if (format === "json") {
      return Response.json({ success: true, report }, { headers: { "Cache-Control": "no-store" } });
    }
    const rows = [
      csvRow(["Section", "Field", "Value"]),
      ...Object.entries(report.student).map(([key, value]) =>
        csvRow(["Student", key, Array.isArray(value) ? value.join("; ") : value])),
      ...Object.entries(report.journey).map(([key, value]) =>
        csvRow(["Journey", key, Array.isArray(value) ? value.join("; ") : value])),
      ...report.xpHistory.flatMap((r, i) =>
        Object.entries(r).map(([key, value]) => csvRow([`XP transaction ${i + 1}`, key, value]))),
      ...report.registrations.flatMap((r, i) =>
        Object.entries(r).map(([key, value]) => csvRow([`Registration ${i + 1}`, key, value]))),
      ...report.badges.flatMap((r, i) =>
        Object.entries(r).map(([key, value]) => csvRow([`Badge ${i + 1}`, key, value]))),
    ];
    return new Response(rows.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="youth-initiative-student-report.csv"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const access = adminAccessResponse(error);
    if (access) return access;
    console.error("Admin report generation failed:", error?.message);
    return Response.json({ message: "Student report could not be generated." }, { status: 500 });
  }
}
