import { readCosmosDocument } from "@/services/cosmosData";
import { artworkIdFromPath } from "@/utils/mediaArtwork.mjs";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { id } = await params;
  if (!artworkIdFromPath("/api/media/artwork/" + id)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const record = await readCosmosDocument("admins", "media-artwork:" + id);
    if (record?.role !== "media_artwork" || typeof record.bytes !== "string") {
      return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    return new Response(Buffer.from(record.bytes, "base64"), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Artwork could not be read:", error?.code);
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
