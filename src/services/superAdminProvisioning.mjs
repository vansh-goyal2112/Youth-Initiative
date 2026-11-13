// Guardrails for offline, explicitly authorized Super Admin provisioning.
// This policy never runs as a public API or on server startup.
const saitAddress = email => typeof email === "string" &&
  /^[^@\s]+@(?:edu\.)?sait\.ca$/i.test(email.trim());

export function evaluateSuperAdminPromotion({ actorEmail, targetEmail, actorUser, targetUser, actorRecord, targetRecord }) {
  const actor = actorEmail?.trim().toLowerCase();
  const target = targetEmail?.trim().toLowerCase();
  if (!saitAddress(actor) || !saitAddress(target) || actor === target) {
    throw new Error("Two distinct SAIT administrator identities are required.");
  }
  if (!actorUser || actorUser.disabled || !actorUser.emailVerified ||
      actorUser.email?.trim().toLowerCase() !== actor ||
      !actorRecord || actorRecord.id !== actorUser.uid ||
      actorRecord.role !== "admin" || actorRecord.status !== "active" ||
      actorRecord.adminRole !== "super_admin" ||
      actorRecord.email?.trim().toLowerCase() !== actor) {
    throw new Error("The authorizing identity must be a verified, active Super Admin.");
  }
  if (!targetUser || targetUser.disabled || !targetUser.emailVerified ||
      targetUser.email?.trim().toLowerCase() !== target ||
      !targetRecord || targetRecord.id !== targetUser.uid ||
      targetRecord.role !== "admin" || targetRecord.status !== "active" ||
      targetRecord.email?.trim().toLowerCase() !== target) {
    throw new Error("The target must be an existing active administrator with a verified SAIT email.");
  }
  if (targetRecord.adminRole === "super_admin") return { alreadyProvisioned: true };
  if (!["viewer", "event_staff", "workshop_coordinator", "program_admin"].includes(targetRecord.adminRole)) {
    throw new Error("Target has an unknown role; manual review required.");
  }
  return { alreadyProvisioned: false, actorUid: actorUser.uid, targetUid: targetUser.uid };
}
