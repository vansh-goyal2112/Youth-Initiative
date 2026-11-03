import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { getAdminAudit } from "@/services/adminAudit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await requireAdminPermission(request, "audit.view");
    const events = await getAdminAudit(150);
    return Response.json({ success: true, events }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Unable to load audit events." }, { status: 500 });
  }
}
