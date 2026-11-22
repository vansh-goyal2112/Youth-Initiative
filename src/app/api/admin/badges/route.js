import crypto from "crypto";
import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import {
  createCosmosDocument, readCosmosDocument, isCosmosConflict,
  replaceCosmosDocument, cosmosNow, isCosmosPreconditionFailed,
} from "@/services/cosmosData";
import { BUILT_IN_BADGES, validateBadgeDefinition } from "@/services/customBadges.mjs";
import { loadBadgeDefinitions } from "@/services/badgeCatalogue";

export const runtime = "nodejs";

// Definitions share the existing Cosmos admins container but are separated
// by role=badge_definition. No extra cloud container or secret is required.
export async function GET(request) {
  try {
    await requireAdminPermission(request, "badges.manage");
    const definitions = await loadBadgeDefinitions();
    return Response.json({
      success: true, badges: definitions.map(item => ({
        id: item.id, badgeId: item.badgeId, name: item.name,
        description: item.description, rule: item.rule,
        status: item.status, artworkUrl: item.artworkUrl || "",
        createdAt: item.createdAt, updatedAt: item.updatedAt, builtIn: !!item.builtIn,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Could not load badges." }, { status: 500 });
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
    const builtIn = BUILT_IN_BADGES.find(badge => badge.id === id);
    if (!builtIn && !/^badge-def:[0-9a-f-]{36}$/i.test(id)) {
      return Response.json({ message: "Valid badge ID required." }, { status: 400 });
    }
    const existing = await readCosmosDocument("admins", id);
    if ((existing && existing.role !== "badge_definition") || (!existing && !builtIn)) {
      return Response.json({ message: "Badge definition not found." }, { status: 404 });
    }
    let data;
    try { data = validateBadgeDefinition(body); }
    catch (error) { return Response.json({ message: error.message }, { status: 400 }); }
    try {
      const now = cosmosNow();
      const updates = { ...data, updatedAt: now, updatedBy: actor.uid };
      const saved = existing
        ? await replaceCosmosDocument("admins", existing, updates)
        : await createCosmosDocument("admins", {
            id, badgeId: builtIn.badgeId, role: "badge_definition",
            createdAt: now, createdBy: actor.uid, ...updates,
          });
      return Response.json({ success: true, badge: saved,
        message: "Badge updated. Archived badges stop new automatic awards; earned badges remain preserved." });
    } catch (error) {
      if (isCosmosPreconditionFailed(error) || isCosmosConflict(error)) {
        return Response.json({ message: "Badge was updated by someone else. Refresh and try again." }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Badge could not be updated." }, { status: 500 });
  }
}
