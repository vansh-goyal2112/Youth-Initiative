import crypto from "crypto";
import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import {
  queryCosmosDocuments, createCosmosDocument, readCosmosDocument,
  replaceCosmosDocument, cosmosNow, isCosmosPreconditionFailed,
} from "@/services/cosmosData";
import { validateBadgeDefinition } from "@/services/customBadges.mjs";

export const runtime = "nodejs";

// Definitions share the existing Cosmos admins container but are separated
// by role=badge_definition. No extra cloud container or secret is required.
export async function GET(request) {
  try {
    await requireAdminPermission(request, "badges.manage");
    const definitions = await queryCosmosDocuments("admins",
      "SELECT * FROM c WHERE c.role = @role ORDER BY c.createdAt DESC",
      [{ name: "@role", value: "badge_definition" }]);
    return Response.json({
      success: true, badges: definitions.map(item => ({
        id: item.id, badgeId: item.badgeId, name: item.name,
        description: item.description, rule: item.rule,
        status: item.status, artworkUrl: item.artworkUrl || "",
        createdAt: item.createdAt, updatedAt: item.updatedAt,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Could not load custom badges." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const actor = await requireAdminPermission(request, "badges.manage");
    const body = await request.json().catch(() => null);
    let data;
    try { data = validateBadgeDefinition(body); }
    catch (error) { return Response.json({ message: error.message }, { status: 400 }); }
    const uid = crypto.randomUUID();
    const now = cosmosNow();
    const saved = await createCosmosDocument("admins", {
      id: "badge-def:" + uid, badgeId: "custom:" + uid,
      role: "badge_definition", ...data,
      createdAt: now, updatedAt: now, createdBy: actor.uid,
    });
    return Response.json({ success: true, badge: saved,
      message: "Badge created. Its automatic rule is active for future completions." }, { status: 201 });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Custom badge could not be created." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const actor = await requireAdminPermission(request, "badges.manage");
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!/^badge-def:[0-9a-f-]{36}$/i.test(id)) {
      return Response.json({ message: "Valid badge ID required." }, { status: 400 });
    }
    const existing = await readCosmosDocument("admins", id);
    if (!existing || existing.role !== "badge_definition") {
      return Response.json({ message: "Badge definition not found." }, { status: 404 });
    }
    let data;
    try { data = validateBadgeDefinition(body); }
    catch (error) { return Response.json({ message: error.message }, { status: 400 }); }
    try {
      const saved = await replaceCosmosDocument("admins", existing, {
        ...data, updatedAt: cosmosNow(), updatedBy: actor.uid,
      });
      return Response.json({ success: true, badge: saved,
        message: "Badge updated. Archived badges stop new automatic awards; earned badges remain preserved." });
    } catch (error) {
      if (isCosmosPreconditionFailed(error)) {
        return Response.json({ message: "Badge was updated by someone else. Refresh and try again." }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Custom badge could not be updated." }, { status: 500 });
  }
}
