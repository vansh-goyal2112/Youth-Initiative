// Explicit, operator-initiated Super Admin promotion for an EXISTING active
// employee. No public route, role bypass, auto-promotion, CI, or startup hook.
// Run from a trusted workstation with existing Firebase/Cosmos credentials.
import { randomUUID } from "node:crypto";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { evaluateSuperAdminPromotion } from "../src/services/superAdminProvisioning.mjs";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--dry-run", "--confirm"].includes(args[0])) {
  throw new Error("Usage: node --env-file=.env.local scripts/promoteExistingSuperAdmin.mjs --dry-run (or --confirm)");
}
const confirm = args[0] === "--confirm";
const targetEmail = process.env.TARGET_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const actorEmail = process.env.AUTHORIZING_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
if (!targetEmail || !actorEmail) {
  throw new Error("Set TARGET_SUPER_ADMIN_EMAIL and AUTHORIZING_SUPER_ADMIN_EMAIL to the two verified SAIT accounts.");
}
if (confirm && process.env.CONFIRM_SUPER_ADMIN_PROMOTION !== "YES_I_APPROVE_THIS_PROMOTION") {
  throw new Error("Explicit CONFIRM_SUPER_ADMIN_PROMOTION acknowledgement is required for --confirm.");
}
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!privateKey || !process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
  throw new Error("Firebase Admin credentials are required. Never paste them into source code.");
}
const firebase = getApps().length ? getApp() : initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey,
  }),
});
const auth = getAuth(firebase);
const [actorUser, targetUser] = await Promise.all([
  auth.getUserByEmail(actorEmail), auth.getUserByEmail(targetEmail),
]);
const endpoint = process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error("COSMOS_ENDPOINT must identify the authorized environment.");
const client = process.env.COSMOS_KEY
  ? new CosmosClient({ endpoint, key: process.env.COSMOS_KEY })
  : new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const admins = client.database(process.env.COSMOS_DATABASE_NAME || "YouthInitiative").container("admins");
async function readAdmin(uid) {
  const { resource } = await admins.item(uid, uid).read();
  return resource;
}
const [actorRecord, targetRecord] = await Promise.all([
  readAdmin(actorUser.uid), readAdmin(targetUser.uid),
]);
const decision = evaluateSuperAdminPromotion({
  actorEmail, targetEmail, actorUser, targetUser, actorRecord, targetRecord,
});
if (decision.alreadyProvisioned) {
  console.log("The verified target is already an active Super Admin. No changes made.");
  process.exit(0);
}
if (!targetRecord._etag) throw new Error("Target record lacks concurrency metadata; aborting.");
if (!confirm) {
  console.log("DRY RUN PASS: target is an existing verified active SAIT administrator and authorizer is an active Super Admin. Nothing changed.");
  process.exit(0);
}
const now = new Date().toISOString();
const { _rid, _self, _etag, _attachments, _ts, ...data } = targetRecord;
const replacement = {
  ...data,
  adminRole: "super_admin",
  permissionOverrides: {},
  updatedBy: actorUser.uid,
  updatedAt: now,
  promotedAt: now,
  promotionMethod: "offline-approved-provisioning",
};
const auditBase = {
  role: "audit", actorUid: actorUser.uid,
  action: "admins.promote_super_admin", resource: "admin:" + targetUser.uid,
  createdAt: now,
};
// Record intent BEFORE the privilege change. If auditing fails, fail closed.
await admins.items.create({ id: "audit:" + randomUUID(), ...auditBase, outcome: "attempted" });
await admins.item(targetUser.uid, targetUser.uid).replace(replacement, {
  accessCondition: { type: "IfMatch", condition: targetRecord._etag },
});
try {
  await admins.items.create({
    id: "audit:" + randomUUID(), ...auditBase,
    outcome: "completed", createdAt: new Date().toISOString(),
  });
} catch (error) {
  console.error("PROMOTION MAY HAVE SUCCEEDED but final audit write failed. Inspect the target record; do not blindly rerun.", error?.code || error?.message);
  throw error;
}
const confirmed = await readAdmin(targetUser.uid);
if (confirmed.adminRole !== "super_admin" || confirmed.status !== "active") {
  throw new Error("Read-back did not confirm Super Admin status; investigate before retrying.");
}
console.log("SUCCESS: Existing active administrator promoted to Super Admin with all role permissions. MFA settings preserved.");
