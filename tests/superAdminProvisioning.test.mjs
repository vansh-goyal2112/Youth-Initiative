import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSuperAdminPromotion } from "../src/services/superAdminProvisioning.mjs";

const actorUser = { uid: "admin-a", email: "owner@sait.ca", emailVerified: true, disabled: false };
const targetUser = { uid: "admin-b", email: "abdullah.rafih@sait.ca", emailVerified: true, disabled: false };
const actorRecord = { id: "admin-a", role: "admin", status: "active", adminRole: "super_admin", email: "owner@sait.ca" };
const targetRecord = { id: "admin-b", role: "admin", status: "active", adminRole: "viewer", email: "abdullah.rafih@sait.ca" };
const data = { actorEmail: actorUser.email, targetEmail: targetUser.email, actorUser, targetUser, actorRecord, targetRecord };

test("offline promotion permits an existing verified active admin only with a distinct active Super Admin authorizer", () => {
  assert.deepEqual(evaluateSuperAdminPromotion(data), { alreadyProvisioned: false, actorUid: "admin-a", targetUid: "admin-b" });
  assert.equal(evaluateSuperAdminPromotion({ ...data, targetRecord: { ...targetRecord, adminRole: "super_admin" } }).alreadyProvisioned, true);
});

test("no self-promotion, unknown staff or bypass for unverified and disabled Firebase identities", () => {
  assert.throws(() => evaluateSuperAdminPromotion({ ...data, actorEmail: targetUser.email }), /Two distinct/);
  assert.throws(() => evaluateSuperAdminPromotion({ ...data, targetUser: { ...targetUser, emailVerified: false } }), /verified SAIT/);
  assert.throws(() => evaluateSuperAdminPromotion({ ...data, targetUser: { ...targetUser, disabled: true } }), /verified SAIT/);
  assert.throws(() => evaluateSuperAdminPromotion({ ...data, targetRecord: null }), /existing active/);
  assert.throws(() => evaluateSuperAdminPromotion({ ...data, targetRecord: { ...targetRecord, status: "pending" } }), /existing active/);
});

test("only a verified, active existing Super Admin can authorize offline promotion", () => {
  assert.throws(() => evaluateSuperAdminPromotion({ ...data, actorRecord: { ...actorRecord, adminRole: "program_admin" } }), /active Super Admin/);
  assert.throws(() => evaluateSuperAdminPromotion({ ...data, actorUser: { ...actorUser, emailVerified: false } }), /active Super Admin/);
  assert.throws(() => evaluateSuperAdminPromotion({ ...data, actorRecord: { ...actorRecord, status: "inactive" } }), /active Super Admin/);
  assert.throws(() => evaluateSuperAdminPromotion({ ...data, targetRecord: { ...targetRecord, adminRole: "unexpected" } }), /unknown role/);
});
