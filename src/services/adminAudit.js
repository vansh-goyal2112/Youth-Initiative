import crypto from "node:crypto";
import { createCosmosDocument, queryCosmosDocuments } from "@/services/cosmosData";

// Append-only audit entries use the existing administrators container, with a
// dedicated ID namespace. This avoids a Cosmos infrastructure migration.
// Admin account queries MUST filter role='admin', not SELECT * unfiltered.
// Never record passwords, access tokens, request bodies, or student PII here.
export async function recordAdminAudit({ actorUid, action, resource, outcome = "attempted" }) {
  if (!actorUid || !action || !resource) {
    throw new Error("Audit actor, action and resource are required.");
  }
  const now = new Date().toISOString();
  await createCosmosDocument("admins", {
    id: `audit:${crypto.randomUUID()}`,
    role: "audit",
    actorUid,
    action,
    resource,
    outcome,
    createdAt: now,
  });
}

export async function getAdminAudit(limit = 100) {
  const boundedLimit = Math.min(200, Math.max(1, Math.trunc(limit) || 100));
  return queryCosmosDocuments("admins", `
    SELECT TOP ${boundedLimit} c.id, c.actorUid, c.action,
      c.resource, c.outcome, c.createdAt
    FROM c WHERE c.role = "audit"
    ORDER BY c.createdAt DESC
  `);
}
