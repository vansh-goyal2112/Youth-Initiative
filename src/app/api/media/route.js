import { readCosmosDocument } from "@/services/cosmosData";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [banner, reward] = await Promise.all([
      readCosmosDocument("admins", "ui-media:banner"),
      readCosmosDocument("admins", "ui-media:reward"),
    ]);
    return Response.json({
      bannerUrl: banner?.url || null,
      rewardUrl: reward?.url || null,
    }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return Response.json({ bannerUrl: null, rewardUrl: null },
      { headers: { "Cache-Control": "no-store" } });
  }
}
