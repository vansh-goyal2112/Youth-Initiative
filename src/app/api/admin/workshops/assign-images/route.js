import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { queryCosmosDocuments, replaceCosmosDocument, cosmosNow } from "@/services/cosmosData";
import {
  assignWorkshopImage,
  shouldAssignWorkshopImage,
} from "@/utils/workshopImageAssignment.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    await requireAdminPermission(request, "workshops.edit");
    const all = await queryCosmosDocuments("workshops", "SELECT * FROM c");
    let assigned = 0;
    let needsImage = 0;
    let unchanged = 0;

    for (const workshop of all) {
      if (!shouldAssignWorkshopImage(workshop)) {
        unchanged++;
        continue;
      }

      const assignment = assignWorkshopImage(workshop);
      if (!assignment.image && !workshop.image && workshop.imageStatus === "needs_image") {
        needsImage++;
        continue;
      }
      await replaceCosmosDocument("workshops", workshop, {
        ...assignment,
        updatedAt: cosmosNow(),
      });
      if (assignment.imageAssetId) {
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
