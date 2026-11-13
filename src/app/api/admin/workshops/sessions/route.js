import crypto from "crypto";
import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { readCosmosDocument, replaceCosmosDocument, cosmosNow, isCosmosPreconditionFailed } from "@/services/cosmosData";
import { resolveWorkshopSessions, validateSessionInput } from "@/services/workshopSessions.mjs";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await requireAdminPermission(request, "workshops.view");
    const workshopId = new URL(request.url).searchParams.get("workshopId")?.trim();
    if (!workshopId || workshopId.length > 128) return Response.json({ message: "Workshop ID required." }, { status: 400 });
    const workshop = await readCosmosDocument("workshops", workshopId);
    if (!workshop || workshop.status === "deleted") return Response.json({ message: "Workshop not found." }, { status: 404 });
    return Response.json({ success: true, sessions: resolveWorkshopSessions(workshop), workshopTitle: workshop.title });
  } catch (error) {
    return adminAccessResponse(error) || Response.json({ message: "Unable to load workshop sessions." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const actor = await requireAdminPermission(request, "workshops.edit");
    const body = await request.json().catch(() => null);
    const workshopId = typeof body?.workshopId === "string" ? body.workshopId.trim() : "";
    const action = body?.action;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    if (!workshopId || workshopId.length > 128 || !["add", "edit", "archive", "duplicate"].includes(action)) {
      return Response.json({ message: "Valid workshop and action required." }, { status: 400 });
    }
    const workshop = await readCosmosDocument("workshops", workshopId);
    if (!workshop || workshop.status === "deleted") return Response.json({ message: "Workshop not found." }, { status: 404 });
    const sessions = resolveWorkshopSessions(workshop).map(item => ({ ...item }));
    let next;
    const index = sessions.findIndex(item => item.id === sessionId);
    if (["edit", "archive", "duplicate"].includes(action) && index < 0) {
      return Response.json({ message: "Session not found. Refresh the workshop." }, { status: 404 });
    }
    try {
      if (action === "add") {
        next = { ...validateSessionInput(body.session), id: crypto.randomUUID(), createdAt: cosmosNow(), createdBy: actor.uid };
        sessions.push(next);
      } else if (action === "edit") {
        next = { ...sessions[index], ...validateSessionInput(body.session), updatedAt: cosmosNow(), updatedBy: actor.uid };
        sessions[index] = next;
      } else if (action === "archive") {
        next = { ...sessions[index], status: "archived", archivedAt: cosmosNow(), updatedBy: actor.uid };
        sessions[index] = next;
      } else if (action === "duplicate") {
        next = { ...sessions[index], id: crypto.randomUUID(), status: "archived",
          createdAt: cosmosNow(), createdBy: actor.uid, duplicatedFrom: sessionId };
        sessions.push(next);
      }
    } catch (error) {
      return Response.json({ message: error.message || "Session details are invalid." }, { status: 400 });
    }
    try {
      await replaceCosmosDocument("workshops", workshop, {
        sessions, updatedAt: cosmosNow(), updatedBy: actor.uid,
      });
    } catch (error) {
      if (isCosmosPreconditionFailed(error)) return Response.json({ message: "Workshop was updated by someone else. Refresh before saving." }, { status: 409 });
      throw error;
    }
    return Response.json({ success: true, sessions, session: next,
      message: action === "archive" ? "Session archived. Historical attendance remains intact." : "Session saved successfully." });
  } catch (error) {
    return adminAccessResponse(error) || Response.json({ message: "Unable to save the workshop session." }, { status: 500 });
  }
}
