import { requireActiveStudent, studentAccessResponse } from "@/services/studentAccess";
import { queryCosmosDocuments } from "@/services/cosmosData";
import { studentRedemptionHistory } from "@/utils/studentRedemptionHistory.mjs";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    // Student identity comes exclusively from the verified Firebase session,
    // never from user-submitted query parameters.
    const { uid: studentId } = await requireActiveStudent(request);
    const records = await queryCosmosDocuments(
      "xpTransactions",
      `SELECT c.id, c.action, c.status, c.points, c.note, c.completedAt, c.createdAt
       FROM c
       WHERE c.studentId = @studentId
         AND c.action = @action
         AND c.status = @status
       ORDER BY c.createdAt DESC`,
      [
        { name: "@studentId", value: studentId },
        { name: "@action", value: "xp_redemption" },
        { name: "@status", value: "completed" },
      ]
    );

    return Response.json({
      success: true,
      redemptions: studentRedemptionHistory(records),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const denied = studentAccessResponse(error);
    if (denied) return denied;
    console.error("Student redemption history unavailable:", error);
    return Response.json({
      success: false,
      message: "Your redemption history could not be loaded. Try again.",
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
