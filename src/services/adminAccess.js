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

  return {
    uid:
      decodedToken.uid,

    email:
      decodedToken.email ||
      adminData.email ||
      null,

    adminData,
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