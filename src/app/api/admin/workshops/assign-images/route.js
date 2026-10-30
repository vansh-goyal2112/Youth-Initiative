import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { queryCosmosDocuments, replaceCosmosDocument, cosmosNow } from "@/services/cosmosData";
import {
  assignWorkshopImage,
  findWorkshopImageByTitle,
  shouldAssignWorkshopImage,
  workshopImageUsage,
} from "@/utils/workshopImageAssignment.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    await requireAdminPermission(request, "workshops.edit");
    const all = await queryCosmosDocuments("workshops", "SELECT * FROM c");
    const used = workshopImageUsage(all);
    let assigned = 0;
    let needsImage = 0;
    let unchanged = 0;

    // Reserve accurate one-to-one workshop/title matches before assigning
    // spare artwork to workshops without their own curated photo.
    const prioritized = [...all].sort(
      (a, b) =>
        Number(Boolean(findWorkshopImageByTitle(b.title))) -
        Number(Boolean(findWorkshopImageByTitle(a.title)))
    );
    for (const workshop of prioritized) {
      if (!shouldAssignWorkshopImage(workshop)) {
        unchanged++;
        continue;
      }

      const assignment = assignWorkshopImage(workshop, used);
      await replaceCosmosDocument("workshops", workshop, {
        ...assignment,
        updatedAt: cosmosNow(),
      });
      if (assignment.imageAssetId) {
        used.set(assignment.imageAssetId, (used.get(assignment.imageAssetId) || 0) + 1);
        assigned++;
      } else {
        needsImage++;
      }
    }

    return Response.json(
      { success: true, assigned, needsImage, unchanged },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const access = adminAccessResponse(error);
    if (access) return access;
    console.error("Workshop artwork assignment error:", error?.message);
    return Response.json(
      { message: "Could not assign workshop images." },
      { status: 500 }
    );
  }
}
