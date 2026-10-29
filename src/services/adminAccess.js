import { hasAdminPermission, isSaitEmail, resolveAdminPermissions } from "@/services/adminPermissions";
import { recordAdminAudit } from "@/services/adminAudit";
import {
  adminAuth,
} from "@/services/firebaseAdmin";

import {
  requireAppCheck,
} from "@/services/appCheckServer";

import {
  readCosmosDocument,
} from "@/services/cosmosData";

export async function requireActiveAdmin(
  request
) {
  /*
    Layer 1:
    verify that the request came from
    our registered application.
  */

  await requireAppCheck(
    request
  );

  /*
    Layer 2:
    verify Firebase Authentication.

    Firebase Auth remains in place
    during the Firestore -> Cosmos
    migration.
  */

  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    const error =
      new Error(
        "Authentication required."
      );

    error.status = 401;

    throw error;
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    const error =
      new Error(
        "Authentication required."
      );

    error.status = 401;

    throw error;
  }

  let decodedToken;

  try {
    decodedToken =
      await adminAuth.verifyIdToken(
        token,
        true
      );
  } catch {
    const error =
      new Error(
        "Administrator session is invalid or expired."
      );

    error.status = 401;

    throw error;
  }

  // Email ownership is required even if a stale Cosmos admin record exists.
  if (!decodedToken.email_verified || !isSaitEmail(decodedToken.email)) {
    const error = new Error("A verified SAIT email is required.");
    error.status = 403;
    throw error;
  }

  /*
    Layer 3:
    verify administrator authorization
    from Cosmos DB.
  */

  const adminData =
    await readCosmosDocument(
      "admins",
      decodedToken.uid
    );

  if (
    !adminData
  ) {
    const error =
      new Error(
        "Administrator access required."
      );

    error.status = 403;

    throw error;
  }

  if (!isSaitEmail(adminData.email) ||
      adminData.email.trim().toLowerCase() !== decodedToken.email.trim().toLowerCase()) {
    const error = new Error("Administrator identity does not match the approved account.");
    error.status = 403;
    throw error;
  }

  if (
    adminData.role !==
      "admin" ||
    adminData.status !==
      "active"
  ) {
    const error =
      new Error(
        "Administrator access is inactive."
      );

    error.status = 403;

    throw error;
  }

  // An unassigned legacy admin cannot inherit the new privileges.
  if (resolveAdminPermissions(adminData).length === 0) {
    const error = new Error("Administrator role assignment is required.");
    error.status = 403;
    throw error;
  }

  return {
    uid:
      decodedToken.uid,

    email:
      decodedToken.email ||
      adminData.email ||
      null,

    adminData,
    mfaVerified: decodedToken.firebase?.sign_in_second_factor === "totp",
  };
}

export function adminAccessResponse(
  error
) {
  if (
    error?.status === 401 ||
    error?.status === 403
  ) {
    return Response.json(
      {
        success: false,

        message:
          error.message,
      },
      {
        status:
          error.status,
      }
    );
  }

  return null;
}
export async function requireAdminPermission(request, permission) {
  const admin = await requireActiveAdmin(request);
  if (process.env.ADMIN_REQUIRE_MFA === "true" && !admin.mfaVerified) {
    const error = new Error("Authenticator verification required. Open Account Security to enroll and sign in again.");
    error.status = 403;
    throw error;
  }
  if (!hasAdminPermission(admin.adminData, permission)) {
    const error = new Error("You do not have permission for this action.");
    error.status = 403;
    throw error;
  }
  // Fail closed if a privileged state-changing request cannot be audited.
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    await recordAdminAudit({
      actorUid: admin.uid,
      action: permission,
      resource: new URL(request.url).pathname,
    });
  }
  return admin;
}
