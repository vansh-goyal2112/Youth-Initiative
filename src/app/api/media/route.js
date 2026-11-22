import { readCosmosDocument } from "@/services/cosmosData";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [banner, reward, landing] = await Promise.all([
      readCosmosDocument("admins", "ui-media:banner"),
      readCosmosDocument("admins", "ui-media:reward"),
      readCosmosDocument("admins", "ui-media:landing"),
    ]);
    return Response.json({
      landingUrl: landing?.url || null,
      bannerUrl: banner?.url || null,
      rewardUrl: reward?.url || null,
    }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return Response.json({ bannerUrl: null, rewardUrl: null, landingUrl: null },
      { headers: { "Cache-Control": "no-store" } });
  }
}
