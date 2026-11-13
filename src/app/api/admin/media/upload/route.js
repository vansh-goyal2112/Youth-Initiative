import crypto from "crypto";
import { getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import {
  createCosmosDocument, readCosmosDocument, replaceCosmosDocument, cosmosNow,
} from "@/services/cosmosData";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = Object.freeze({
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
});
const KINDS = Object.freeze({
  workshop: "workshops.edit",
  badge: "badges.manage",
  banner: "workshops.edit",
  reward: "workshops.edit",
});

function verifyMagic(bytes, mime) {
  if (mime === "image/png") return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (mime === "image/jpeg") return bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/webp") return bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return false;
}

export async function GET(request) {
  try {
    await requireAdminPermission(request, "workshops.edit");
    const kind = new URL(request.url).searchParams.get("kind") || "";
    if (kind !== "banner" && kind !== "reward") {
      return Response.json({ message: "Only global banner and reward settings can be queried here." }, { status: 400 });
    }
    const record = await readCosmosDocument("admins", "ui-media:" + kind);
    return Response.json({ success: true, url: record?.url || null });
  } catch (error) {
    return adminAccessResponse(error) ||
      Response.json({ message: "Could not load uploaded artwork." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const kind = typeof form.get("kind") === "string" ? form.get("kind").trim() : "";
    const recordId = typeof form.get("recordId") === "string" ? form.get("recordId").trim() : "";
    if (!Object.hasOwn(KINDS, kind) || (["workshop", "badge"].includes(kind) && (!recordId || recordId.length > 128))) {
      return Response.json({ message: "Valid image category and target record are required." }, { status: 400 });
    }
    const actor = await requireAdminPermission(request, KINDS[kind]);
    const upload = form.get("file");
    if (!upload || typeof upload.arrayBuffer !== "function" || upload.size <= 0 || upload.size > MAX_SIZE ||
        !Object.hasOwn(TYPES, upload.type)) {
      return Response.json({ message: "Upload a PNG, JPG or WebP image under 5 MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await upload.arrayBuffer());
    if (bytes.length !== upload.size || !verifyMagic(bytes, upload.type)) {
      return Response.json({ message: "The file does not contain a valid image matching its declared format." }, { status: 400 });
    }
    const app = getApps()[0];
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!app || !bucketName) {
      return Response.json({ message: "Firebase Storage is not configured for this deployment. No image was saved." }, { status: 503 });
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

    const bucket = getStorage(app).bucket(bucketName);
    const objectName = "youth-initiatives/" + kind + "/" + crypto.randomUUID() + "." + TYPES[upload.type];
    const token = crypto.randomUUID();
    await bucket.file(objectName).save(bytes, {
      resumable: false, contentType: upload.type, validation: "crc32c",
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    });
    const url = "https://firebasestorage.googleapis.com/v0/b/" + encodeURIComponent(bucketName) +
      "/o/" + encodeURIComponent(objectName) + "?alt=media&token=" + token;

    const at = cosmosNow();
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

    return Response.json({
      success: true, url, sizeBytes: bytes.length, contentType: upload.type,
      message: "Image uploaded to Firebase Storage and linked to the correct database record.",
    });
  } catch (error) {
    const denied = adminAccessResponse(error);
    if (denied) return denied;
    console.error("Image upload failed:", error?.message);
    return Response.json({
      message: "Image could not be uploaded or saved. Verify Firebase Storage is enabled and the service account can write to the bucket.",
    }, { status: 500 });
  }
}
