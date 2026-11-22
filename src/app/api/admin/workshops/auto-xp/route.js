import { describeAdminAudit, withAdminAudit } from "@/services/adminAudit";
import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { automaticWorkshopXp, needsLegacyXpAssignment } from "@/services/workshopXpAssignment.mjs";
import { queryCosmosDocuments, readCosmosDocument, replaceCosmosDocument, cosmosNow, isCosmosPreconditionFailed } from "@/services/cosmosData";

export const runtime = "nodejs";

// Staff-triggered, previewable migration. Never silently rewrite earned XP.
async function assignXp(request) {
  try {
    const admin = await requireAdminPermission(request, "workshops.edit");
    const { preview = true } = await request.json().catch(() => ({}));
    if (typeof preview !== "boolean") return Response.json({ message: "Invalid preview flag." }, { status: 400 });
    const workshops = await queryCosmosDocuments("workshops", "SELECT * FROM c WHERE NOT IS_DEFINED(c.status) OR c.status != 'deleted'");
    const eligible = workshops.filter(needsLegacyXpAssignment);
    if (preview) {
      describeAdminAudit(request, { outcome: "unchanged", details: ["Previewed automatic XP assignment"] });
      return Response.json({ success: true, preview: true, eligibleCount: eligible.length,
        sample: eligible.slice(0, 8).map(w => ({ title: w.title, currentXp: w.xpReward ?? null, newXp: automaticWorkshopXp(w.id) })) });
    }
    let updatedCount = 0;
    let skippedCount = 0;
    for (const candidate of eligible) {
      let updated = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await readCosmosDocument("workshops", candidate.id);
        if (!needsLegacyXpAssignment(current)) break;
        try {
          await replaceCosmosDocument("workshops", current, {
            xpReward: automaticWorkshopXp(current.id),
            xpRewardSource: "automatic",
            xpAssignedBy: admin.uid,
            updatedAt: cosmosNow(),
          });
          updated = true;
          break;
        } catch (error) {
          if (!isCosmosPreconditionFailed(error)) throw error;
        }
      }
      if (updated) updatedCount++;
      else skippedCount++;
    }
    describeAdminAudit(request, { details: [updatedCount + " experience XP rewards updated", skippedCount + " skipped"], ...(!updatedCount ? { outcome: "unchanged" } : {}) });
    return Response.json({ success: true, updatedCount, skippedCount });
  } catch (error) {
    const denied = adminAccessResponse(error);
    if (denied) return denied;
    console.error("Automatic experience XP assignment failed:", error);
    return Response.json({ success: false, message: "Could not assign experience XP." }, { status: 500 });
  }
}

export const POST = withAdminAudit(assignXp);
