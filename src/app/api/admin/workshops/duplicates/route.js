import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { describeAdminAudit, withAdminAudit } from "@/services/adminAudit";
import {
  cosmosNow, isCosmosPreconditionFailed, queryCosmosDocuments, readCosmosDocument, replaceCosmosDocument,
} from "@/services/cosmosData";
import { checkWorkshopDuplicate } from "@/utils/workshopDuplicates.mjs";

export const runtime = "nodejs";

async function checkPair(keepId, duplicateId) {
  if (![keepId, duplicateId].every(id => typeof id === "string" && id.length > 0 && id.length <= 128)) {
    return { message: "Choose the workshop to keep and the duplicate." };
  }
  const [keep, duplicate] = await Promise.all([keepId, duplicateId].map(id => readCosmosDocument("workshops", id)));
  const message = checkWorkshopDuplicate(keep, duplicate);
  if (message) return { message };

  const references = await Promise.all(["registrations", "attendanceSessions", "xpTransactions"].map(container =>
    queryCosmosDocuments(container, "SELECT TOP 1 c.id FROM c WHERE c.workshopId = @workshopId",
      [{ name: "@workshopId", value: duplicate.id }])
  ));
  if (references.some(records => records.length > 0)) {
    return { message: "The duplicate already has registrations, attendance, or XP records. Review this pair manually." };
  }
  return { keep, duplicate };
}

export async function GET(request) {
  try {
    await requireAdminPermission(request, "workshops.edit");
    const params = new URL(request.url).searchParams;
    const result = await checkPair(params.get("keepId"), params.get("duplicateId"));
    if (result.message) return Response.json({ message: result.message }, { status: 409 });
    return Response.json({
      keepTitle: result.keep.title, duplicateTitle: result.duplicate.title,
      keepVersion: result.keep._etag, duplicateVersion: result.duplicate._etag,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Unable to check these workshop records." }, { status: 500 });
  }
}

export const POST = withAdminAudit(async request => {
  try {
    const actor = await requireAdminPermission(request, "workshops.edit", { auditAction: "workshops.consolidate" });
    const body = await request.json().catch(() => null);
    if (!body?.keepVersion || !body?.duplicateVersion) {
      return Response.json({ message: "Review the duplicate pair before confirming." }, { status: 400 });
    }
    const { keep, duplicate, message } = await checkPair(body.keepId, body.duplicateId);
    if (message) return Response.json({ message }, { status: 409 });
    if (body.keepVersion !== keep._etag || body.duplicateVersion !== duplicate._etag) {
      return Response.json({ message: "A workshop changed after your review. Check the pair again." }, { status: 409 });
    }

    await replaceCosmosDocument("workshops", duplicate, {
      status: "inactive", duplicateOf: keep.id, updatedAt: cosmosNow(), updatedBy: actor.uid,
    });
    describeAdminAudit(request, { subject: duplicate.title, details: ["Kept active: " + keep.title] });
    return Response.json({ success: true });
  } catch (error) {
    if (isCosmosPreconditionFailed(error)) {
      return Response.json({ message: "The duplicate changed. Review the pair again." }, { status: 409 });
    }
    return adminAccessResponse(error) ||
      Response.json({ message: "Unable to consolidate the duplicate workshop." }, { status: 500 });
  }
});
