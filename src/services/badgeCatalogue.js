import { queryCosmosDocuments } from "@/services/cosmosData";
import { mergeBadgeDefinitions } from "@/services/customBadges.mjs";

export async function loadBadgeDefinitions() {
  const saved = await queryCosmosDocuments("admins",
    "SELECT * FROM c WHERE c.role = @role ORDER BY c.createdAt DESC",
    [{ name: "@role", value: "badge_definition" }]
  );
  return mergeBadgeDefinitions(saved);
}
