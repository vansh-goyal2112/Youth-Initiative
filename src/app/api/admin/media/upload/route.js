import { describeAdminAudit, withAdminAudit } from "@/services/adminAudit";
import crypto from "crypto";
import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import {
  createCosmosDocument, deleteCosmosDocument, readCosmosDocument, replaceCosmosDocument,
  cosmosNow, isCosmosConflict, isCosmosPreconditionFailed,
} from "@/services/cosmosData";

import { MAX_ARTWORK_UPLOAD_BYTES, prepareArtwork } from "@/services/prepareArtwork.mjs";

export const runtime = "nodejs";

const KINDS = Object.freeze({
  workshop: "workshops.edit",
  badge: "badges.manage",
  landing: "workshops.edit",
  banner: "workshops.edit",
  reward: "workshops.edit",
});

export async function GET(request) {
  try {
    await requireAdminPermission(request, "workshops.edit");
    const kind = new URL(request.url).searchParams.get("kind") || "";
    if (!["banner", "landing", "reward"].includes(kind)) {
      return Response.json({ message: "Choose a valid site image setting." }, { status: 400 });
    }
    const record = await readCosmosDocument("admins", "ui-media:" + kind);
    return Response.json({ success: true, url: record?.url || null });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Could not load uploaded artwork." }, { status: 500 });
  }
}

async function uploadArtwork(request) {
  try {
    const form = await request.formData().catch(() => null);
    if (!form) return Response.json({ message: "Select an image to upload." }, { status: 400 });
    const kind = typeof form.get("kind") === "string" ? form.get("kind").trim() : "";
    const recordId = typeof form.get("recordId") === "string" ? form.get("recordId").trim() : "";
    if (!Object.hasOwn(KINDS, kind) || (["workshop", "badge"].includes(kind) && (!recordId || recordId.length > 128))) {
      return Response.json({ message: "Valid image category and target record are required." }, { status: 400 });
    }
    const actor = await requireAdminPermission(request, KINDS[kind]);
    const upload = form.get("file");
    if (!upload || typeof upload.arrayBuffer !== "function" ||
        upload.size <= 0 || upload.size > MAX_ARTWORK_UPLOAD_BYTES) {
      return Response.json({ message: "Upload a PNG, JPG or WebP image up to 5 MB." }, { status: 400 });
    }
    let record = null;
    if (kind === "workshop") {
      record = await readCosmosDocument("workshops", recordId);
      if (!record || record.status === "deleted") return Response.json({ message: "Workshop not found." }, { status: 404 });
    } else if (kind === "badge") {
      record = await readCosmosDocument("admins", recordId);
      if (!record || record.role !== "badge_definition") return Response.json({ message: "Badge definition not found." }, { status: 404 });
    } else {
      record = await readCosmosDocument("admins", "ui-media:" + kind);
    }

    describeAdminAudit(request, { action: "artwork." + kind, subject: record?.title || record?.name });
    let bytes;
    try {
      bytes = await prepareArtwork(Buffer.from(await upload.arrayBuffer()), upload.type);
    } catch {
      return Response.json({ message: "Choose a valid still PNG, JPG or WebP image up to 5 MB and 32 megapixels." },
        { status: 400 });
    }

    const id = crypto.randomUUID();
    const url = "/api/media/artwork/" + id;
    const assetId = "media-artwork:" + id;
    const at = cosmosNow();
    await createCosmosDocument("admins", {
      id: assetId, role: "media_artwork", bytes: bytes.toString("base64"), createdAt: at,
    });

    try {
      if (kind === "workshop") {
        await replaceCosmosDocument("workshops", record, {
          image: url, imageStatus: "custom", imageAssetId: null,
          updatedAt: at, updatedBy: actor.uid,
        });
      } else if (kind === "badge") {
        await replaceCosmosDocument("admins", record, {
          artworkUrl: url, updatedAt: at, updatedBy: actor.uid,
        });
      } else {
        const fields = { url, role: "media_setting", kind, updatedAt: at, updatedBy: actor.uid };
        if (record) await replaceCosmosDocument("admins", record, fields);
        else await createCosmosDocument("admins", { id: "ui-media:" + kind, ...fields, createdAt: at });
      }
    } catch (error) {
      // These conditional-write errors guarantee this upload was never linked.
      if (isCosmosConflict(error) || isCosmosPreconditionFailed(error)) {
        await deleteCosmosDocument("admins", assetId).catch(() => {});
        return Response.json({ message: "This record changed during the upload. Refresh and try again." },
          { status: 409 });
      }
      throw error;
    }

    return Response.json({ success: true, url, sizeBytes: bytes.length, contentType: "image/webp" });
  } catch (error) {
    const denied = adminAccessResponse(error);
    if (denied) return denied;
    console.error("Image upload failed:", error?.message);
    return Response.json({
      message: "Image could not be saved. Try again.",
    }, { status: 500 });
  }
}

export const POST = withAdminAudit(uploadArtwork);
