// Run locally only after the designated SAIT employee has verified their
// Firebase Authentication account. Requires --env-file=.env.local on Node 20+.
// Does NOT run on application startup, in CI, or via a public HTTP endpoint.
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

const email = process.env.INITIAL_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
if (!email || !/^[^@\s]+@sait\.ca$/.test(email)) {
  throw new Error("Set INITIAL_SUPER_ADMIN_EMAIL to the authorized SAIT employee's exact address.");
}
if (process.env.CONFIRM_SUPER_ADMIN_BOOTSTRAP !== "YES_I_HAVE_VERIFIED_AUTHORIZATION") {
  throw new Error("Explicit CONFIRM_SUPER_ADMIN_BOOTSTRAP confirmation is required.");
}
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!privateKey || !process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
  throw new Error("Firebase Admin credentials are required.");
}
const app = initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey,
}) });
const user = await getAuth(app).getUserByEmail(email);
if (!user.emailVerified || user.disabled || user.email?.toLowerCase() !== email) {
  throw new Error("Super Admin Firebase identity must be verified and active before provisioning.");
}
const endpoint = process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error("COSMOS_ENDPOINT is required.");
const client = process.env.COSMOS_KEY
  ? new CosmosClient({ endpoint, key: process.env.COSMOS_KEY })
  : new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const container = client.database(process.env.COSMOS_DATABASE_NAME || "YouthInitiative").container("admins");
const { resource: existing } = await container.item(user.uid, user.uid).read().catch(error => {
  if (error.code === 404 || error.statusCode === 404) return { resource: null };
  throw error;
});
if (existing?.adminRole === "super_admin" && existing.status === "active") {
  console.log("Super Admin already provisioned; no changes made.");
} else if (existing && existing.status !== "pending") {
  throw new Error("Existing administrator record is not pending. Manual security review required.");
} else {
  const now = new Date().toISOString();
  // Cosmos server-managed metadata must never be sent back in replacement documents.
  const { _rid, _self, _etag, _attachments, _ts, ...existingData } = existing || {};
  const document = {
    ...existingData, id: user.uid, firebaseUid: user.uid, role: "admin",
    adminRole: "super_admin", email, status: "active", permissionOverrides: {},
    createdAt: existing?.createdAt || now, updatedAt: now, activatedAt: now,
    bootstrapVersion: 1,
  };
  if (existing) {
    await container.item(user.uid, user.uid).replace(document, {
      accessCondition: { type: "IfMatch", condition: existing._etag },
    });
  } else {
    await container.items.create(document);
  }
  console.log("Authorized initial Super Admin successfully provisioned.");
}
