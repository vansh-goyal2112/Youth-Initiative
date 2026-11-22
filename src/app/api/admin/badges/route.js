import crypto from "crypto";
import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import {
  createCosmosDocument, readCosmosDocument, isCosmosConflict,
  replaceCosmosDocument, cosmosNow, isCosmosPreconditionFailed,
} from "@/services/cosmosData";
import { BUILT_IN_BADGES, validateBadgeDefinition } from "@/services/customBadges.mjs";
import { loadBadgeDefinitions } from "@/services/badgeCatalogue";
import { recordAdminAudit } from "@/services/adminAudit";

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

async function changeBadge(request, initialAction, failureMessage, change) {
  let actor;
  let action = initialAction;
  let subject;
  let response;
  try {
    actor = await requireAdminPermission(request, "badges.manage", { auditAction: initialAction });
    response = await change(actor, (nextAction, badgeName) => {
      action = nextAction;
      subject = badgeName;
    });
  } catch (error) {
    response = adminAccessResponse(error) || Response.json({ message: failureMessage }, { status: 500 });
  }
  if (actor) {
    try {
      await recordAdminAudit({
        actorUid: actor.uid, action, resource: "/api/admin/badges",
        outcome: response.ok ? "success" : "failed", attemptId: actor.auditAttemptId, subject,
      });
    } catch (error) {
      // The original attempt remains in the append-only log. Preserve the
      // mutation response so staff don't retry a badge that was already saved.
      console.error("Badge audit outcome could not be recorded:", error?.code);
    }
  }
  return response;
}

export async function POST(request) {
  return changeBadge(request, "badge.create", "Custom badge could not be created.", async (actor, describe) => {
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
    describe("badge.create", saved.name);
    return Response.json({ success: true, badge: saved,
      message: "Badge created. Its automatic rule is active for future completions." }, { status: 201 });
  });
}

export async function PUT(request) {
  return changeBadge(request, "badge.update", "Badge could not be updated.", async (actor, describe) => {
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
    const previousStatus = (existing || builtIn).status;
    const action = previousStatus === data.status ? "badge.update" :
      data.status === "archived" ? "badge.archive" : "badge.reactivate";
    describe(action);
    try {
      const now = cosmosNow();
      const updates = { ...data, updatedAt: now, updatedBy: actor.uid };
      const saved = existing
        ? await replaceCosmosDocument("admins", existing, updates)
        : await createCosmosDocument("admins", {
            id, badgeId: builtIn.badgeId, role: "badge_definition",
            createdAt: now, createdBy: actor.uid, ...updates,
          });
      describe(action, saved.name);
      return Response.json({ success: true, badge: saved,
        message: "Badge updated. Archived badges stop new automatic awards; earned badges remain preserved." });
    } catch (error) {
      if (isCosmosPreconditionFailed(error) || isCosmosConflict(error)) {
        return Response.json({ message: "Badge was updated by someone else. Refresh and try again." }, { status: 409 });
      }
      throw error;
    }
  });
}
