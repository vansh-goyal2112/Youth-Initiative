import { cosmosNow, isCosmosPreconditionFailed, readCosmosDocument, replaceCosmosDocument } from "@/services/cosmosData";
import { automaticWorkshopXp, needsLegacyXpAssignment } from "@/services/workshopXpAssignment.mjs";

// Persist a historical default only once. Never touch a staff-managed award,
// student balances, completion history or XP transaction ledgers.
export async function ensureWorkshopXpAssigned(workshop) {
  if (!needsLegacyXpAssignment(workshop)) return workshop;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await readCosmosDocument("workshops", workshop.id);
    if (!current || !needsLegacyXpAssignment(current)) return current || workshop;
    try {
      return await replaceCosmosDocument("workshops", current, {
        xpReward: automaticWorkshopXp(current.id),
        xpRewardSource: "automatic",
        updatedAt: cosmosNow(),
      });
    } catch (error) {
      if (!isCosmosPreconditionFailed(error)) throw error;
    }
  }
  return await readCosmosDocument("workshops", workshop.id);
}

export async function ensureWorkshopCatalogueXp(workshops) {
  const results = [];
  for (let offset = 0; offset < workshops.length; offset += 4) {
    results.push(...await Promise.all(
      workshops.slice(offset, offset + 4).map(ensureWorkshopXpAssigned)
    ));
  }
  return results.filter(Boolean);
}
