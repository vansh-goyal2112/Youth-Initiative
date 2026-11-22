import crypto from "node:crypto";
import { createCosmosDocument, queryCosmosDocuments } from "@/services/cosmosData";
import { adminAuth } from "@/services/firebaseAdmin";
import { presentAdminAudit } from "./adminAuditPresentation.mjs";

// Append-only audit entries use the existing administrators container, with a
// dedicated ID namespace. This avoids a Cosmos infrastructure migration.
// Admin account queries MUST filter role='admin', not SELECT * unfiltered.
// Never record passwords, access tokens, request bodies, or private student profile values here.
export async function recordAdminAudit({ actorUid, action, resource, outcome = "attempted", attemptId, subject, details }) {
  if (!actorUid || !action || !resource) {
    throw new Error("Audit actor, action and resource are required.");
  }
  const now = new Date().toISOString();
  const id = `audit:${crypto.randomUUID()}`;
  await createCosmosDocument("admins", {
    id,
    role: "audit",
    actorUid,
    action,
    resource,
    outcome,
    ...(attemptId ? { attemptId } : {}),
    ...(subject ? { subject: subject.slice(0, 200) } : {}),
    ...(details?.length ? { details: details.slice(0, 24).map(detail => detail.slice(0, 300)) } : {}),
    createdAt: now,
  });
  return id;
}

const requests = new WeakMap();

export function trackAdminAuditAttempt(request, entry) {
  const audit = requests.get(request);
  if (audit && !audit.attemptId) Object.assign(audit, entry);
}

export function describeAdminAudit(request, description) {
  const audit = requests.get(request);
  if (audit) Object.assign(audit, description);
}

export function withAdminAudit(handler) {
  return async function auditedHandler(request, ...args) {
    const audit = {};
    requests.set(request, audit);
    let response;
    try {
      response = await handler(request, ...args);
      return response;
    } finally {
      requests.delete(request);
      if (audit.attemptId) {
        const status = response?.status ?? 500;
        const outcome = status >= 500 || status === 202 ? "review" :
          status >= 400 ? "failed" : audit.outcome || "success";
        try {
          await recordAdminAudit({ ...audit, outcome });
        } catch (error) {
          // Keep the initial attempt and the actual mutation response.
          console.error("Admin audit outcome could not be recorded:", error?.code);
        }
      }
    }
  };
}

export async function getAdminAudit(limit = 100) {
  const boundedLimit = Math.min(200, Math.max(1, Math.trunc(limit) || 100));
  const events = await queryCosmosDocuments("admins", `
    SELECT TOP ${boundedLimit * 2} c.id, c.actorUid, c.action,
      c.resource, c.outcome, c.createdAt, c.attemptId, c.subject, c.details
    FROM c WHERE c.role = @role
    ORDER BY c.createdAt DESC
  `, [{ name: "@role", value: "audit" }]);
  if (!events.length) return [];
  const actorUids = [...new Set(events.map(event => event.actorUid).filter(Boolean))];
  const staff = await queryCosmosDocuments("admins", `
    SELECT c.id, c.firstName, c.lastName, c.displayName, c.email
    FROM c WHERE c.role = "admin" AND ARRAY_CONTAINS(@actorUids, c.id)
  `, [{ name: "@actorUids", value: actorUids }]);
  const withoutNames = staff.filter(person => !person.firstName && !person.lastName && !person.displayName && person.email);
  const displayNames = new Map();
  for (let index = 0; index < withoutNames.length; index += 100) {
    const batch = withoutNames.slice(index, index + 100);
    try {
      const { users } = await adminAuth.getUsers(batch.map(person => ({ uid: person.id })));
      const emails = new Map(batch.map(person => [person.id, person.email.trim().toLowerCase()]));
      for (const user of users) {
        if (user.emailVerified && user.email?.trim().toLowerCase() === emails.get(user.uid) && user.displayName?.trim()) {
          displayNames.set(user.uid, user.displayName.trim());
        }
      }
    } catch {
      // Audit records remain readable using the approved staff email.
    }
  }
  return presentAdminAudit(events, staff.map(person => ({
    ...person, displayName: person.displayName || displayNames.get(person.id),
  })), boundedLimit);
}
