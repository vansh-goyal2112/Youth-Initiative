import { describeAdminAudit, withAdminAudit } from "@/services/adminAudit";
import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import {
  createCosmosDocument, queryCosmosDocuments, readCosmosDocument,
  replaceCosmosDocument, cosmosNow, isCosmosPreconditionFailed, isCosmosConflict,
} from "@/services/cosmosData";
import { getXpBalances, redeemXp } from "@/services/xpBalance.mjs";

export const runtime = "nodejs";

function studentName(student) {
  return student.fullName || [student.firstName, student.lastName].filter(Boolean).join(" ") || "Student";
}

async function findStudents(search) {
  const students = await queryCosmosDocuments(
    "students",
    `SELECT TOP 25 c.id, c.fullName, c.firstName, c.lastName, c.youthId, c.accountStatus
     FROM c
     WHERE (NOT IS_DEFINED(c.role) OR IS_NULL(c.role) OR c.role = "student" OR c.role = "")
       AND (CONTAINS(c.fullName, @search, true)
         OR CONTAINS(c.firstName, @search, true)
         OR CONTAINS(c.lastName, @search, true)
         OR CONTAINS(c.youthId, @search, true)
         OR CONTAINS(CONCAT(IIF(IS_STRING(c.firstName), c.firstName, ""), " ", IIF(IS_STRING(c.lastName), c.lastName, "")), @search, true))`,
    [{ name: "@search", value: search }]
  );
  return students.map(student => ({
    id: student.id,
    name: studentName(student),
    youthId: student.youthId || "",
    accountStatus: student.accountStatus || "active",
  })).sort((first, second) => first.name.localeCompare(second.name));
}

async function recentRedemptions() {
  const history = await queryCosmosDocuments(
    "xpTransactions",
    `SELECT TOP 20 c.id, c.studentId, c.points, c.note, c.createdAt, c.status
     FROM c WHERE c.action = "xp_redemption" AND c.status IN ("completed", "processing")
     ORDER BY c.createdAt DESC`
  );
  const uniqueIds = [...new Set(history.map(item => item.studentId).filter(Boolean))];
  const names = new Map(await Promise.all(uniqueIds.map(async id => {
    const student = await readCosmosDocument("students", id);
    return [id, student ? studentName(student) : "Student"];
  })));
  return history.map(item => ({
    id: item.id, name: names.get(item.studentId) || "Student", amount: item.points,
    note: item.note || "", createdAt: item.createdAt, status: item.status,
  }));
}

// Redemption transactions are append-only records, with a stable request ID.
// A pending record is not blindly replayed: the student balance may already have changed.
export async function GET(request) {
  try {
    await requireAdminPermission(request, "xp.redeem");
    const params = new URL(request.url).searchParams;
    const headers = { "Cache-Control": "private, no-store" };
    if (params.has("search")) {
      const search = params.get("search").trim().replace(/\s+/g, " ");
      if (search.length < 2 || search.length > 100) {
        return Response.json({ message: "Enter between 2 and 100 characters." }, { status: 400 });
      }
      return Response.json({ students: await findStudents(search) }, { headers });
    }
    if (params.get("view") === "recent") {
      return Response.json({ history: await recentRedemptions() }, { headers });
    }
    const studentId = params.get("studentId")?.trim();
    if (!studentId || studentId.length > 128) {
      return Response.json({ message: "Student ID is required." }, { status: 400 });
    }
    const student = await readCosmosDocument("students", studentId);
    if (!student || (student.role && student.role !== "student")) {
      return Response.json({ message: "Student not found." }, { status: 404 });
    }
    const history = await queryCosmosDocuments(
      "xpTransactions",
      "SELECT * FROM c WHERE c.studentId = @id AND c.action = @action ORDER BY c.createdAt DESC",
      [{ name: "@id", value: studentId }, { name: "@action", value: "xp_redemption" }]
    );
    const balances = getXpBalances(student);
    return Response.json({
      success: true, ...balances,
      history: history.slice(0, 100).map(item => ({
        id: item.id, amount: item.points, note: item.note || "",
        createdAt: item.createdAt, actorEmail: item.actorEmail || "",
        status: item.status || "unknown",
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "XP history could not be loaded." }, { status: 500 });
  }
}

async function redeem(request) {
  try {
    const acting = await requireAdminPermission(request, "xp.redeem");
    const body = await request.json().catch(() => null);
    const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
    const amount = body?.amount;
    const operationId = typeof body?.operationId === "string" ? body.operationId.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (!studentId || studentId.length > 128 || !Number.isSafeInteger(amount) || amount <= 0 ||
        amount > 1000000 || !/^[0-9a-f-]{36}$/i.test(operationId) || note.length > 200) {
      return Response.json({
        message: "A student, positive whole-number XP amount and unique request ID are required. Notes must be under 200 characters.",
      }, { status: 400 });
    }
    const id = "xp-redemption:" + studentId + ":" + operationId;
    const prior = await readCosmosDocument("xpTransactions", id);
    if (prior) {
      describeAdminAudit(request, { outcome: "unchanged", details: ["This redemption was already submitted"] });
      return Response.json({
        success: prior.status === "completed", alreadyProcessed: true,
        message: prior.status === "completed"
          ? "This redemption was already recorded."
          : "This request is already recorded and needs review. No second deduction was made.",
      }, { status: prior.status === "completed" ? 200 : 409 });
    }

    const student = await readCosmosDocument("students", studentId);
    if (!student || (student.role && student.role !== "student")) {
      return Response.json({ message: "Student not found." }, { status: 404 });
    }
    describeAdminAudit(request, {
      subject: student.youthId ? "Youth ID " + student.youthId : "Student account",
      details: ["XP spent: " + amount],
    });
    try { redeemXp(student, amount); }
    catch (error) { return Response.json({ message: error.message }, { status: 409 }); }

    const now = cosmosNow();
    let transaction;
    try {
      transaction = await createCosmosDocument("xpTransactions", {
        id, studentId, action: "xp_redemption", points: amount,
        actorUid: acting.uid, actorEmail: acting.email || acting.adminData?.email || "",
        note, status: "processing", createdAt: now, updatedAt: now,
      });
    } catch (error) {
      if (isCosmosConflict(error)) {
        return Response.json({ message: "This redemption request was already submitted." }, { status: 409 });
      }
      throw error;
    }

    let updatedStudent = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const fresh = await readCosmosDocument("students", studentId);
      if (!fresh || (fresh.role && fresh.role !== "student")) break;
      let balances;
      try { balances = redeemXp(fresh, amount); }
      catch { break; }
      try {
        updatedStudent = await replaceCosmosDocument("students", fresh, {
          ...balances, updatedAt: cosmosNow(),
        });
        break;
      } catch (error) {
        if (!isCosmosPreconditionFailed(error)) throw error;
      }
    }

    if (!updatedStudent) {
      await replaceCosmosDocument("xpTransactions", transaction, {
        status: "rejected", updatedAt: cosmosNow(),
      });
      return Response.json({
        message: "Current XP has changed. Refresh the student's balance before trying a new request.",
      }, { status: 409 });
    }

    try {
      await replaceCosmosDocument("xpTransactions", transaction, {
        status: "completed", completedAt: cosmosNow(), updatedAt: cosmosNow(),
      });
    } catch (error) {
      console.error("XP deducted but redemption transaction needs review:", id, error?.message);
      return Response.json({
        success: true, reviewPending: true,
        totalXp: updatedStudent.totalXp, currentXp: updatedStudent.currentXp,
        message: "XP was deducted, but the log needs review. Do not repeat the request.",
      }, { status: 202 });
    }

    return Response.json({
      success: true, totalXp: updatedStudent.totalXp,
      currentXp: updatedStudent.currentXp,
      message: "XP redeemed and recorded successfully.",
    });
  } catch (error) {
    const denied = adminAccessResponse(error);
    if (denied) return denied;
    console.error("XP redemption failed:", error?.message);
    return Response.json({
      message: "XP redemption could not be completed. Check the balance and audit log before retrying.",
    }, { status: 500 });
  }
}

export const POST = withAdminAudit(redeem);
