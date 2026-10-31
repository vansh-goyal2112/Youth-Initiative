import { adminAuth } from "@/services/firebaseAdmin";
import { requireAppCheck } from "@/services/appCheckServer";
import { cosmosNow, createCosmosDocument, readCosmosDocument } from "@/services/cosmosData";
import { isSaitEmail } from "@/services/adminPermissions";

export const runtime = "nodejs";

// Register a request ONLY, never an active administrator.
// All authorization decisions are made separately by a verified Super Admin.
export async function POST(request) {
  try {
    await requireAppCheck(request);
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return Response.json({ message: "Authentication required." }, { status: 401 });
    }
    const token = await adminAuth.verifyIdToken(authHeader.slice(7).trim(), true);
    if (!token.email_verified || !isSaitEmail(token.email)) {
      return Response.json({ message: "Verify your SAIT email before requesting access." }, { status: 403 });
    }
    const user = await adminAuth.getUser(token.uid);
    if (user.disabled || !user.emailVerified ||
        user.email?.trim().toLowerCase() !== token.email.trim().toLowerCase()) {
      return Response.json({ message: "Verified email ownership required." }, { status: 403 });
    }
    const existing = await readCosmosDocument("admins", token.uid);
    if (existing) {
      return Response.json({
        success: existing.status === "pending" || existing.status === "active",
        status: existing.status,
        message: existing.status === "pending" ?
          "Your application is awaiting Super Admin review." :
          "An administrator account already exists for this identity.",
      }, { status: existing.status === "pending" || existing.status === "active" ? 200 : 403 });
    }
    const now = cosmosNow();
    try {
      await createCosmosDocument("admins", {
        id: token.uid, firebaseUid: token.uid, role: "admin",
        adminRole: "viewer", email: token.email.trim().toLowerCase(),
        status: "pending", permissionOverrides: {},
        createdAt: now, requestedAt: now,
      });
    } catch (error) {
      if (error?.code === 409 || error?.statusCode === 409) {
        return Response.json({ message: "Access request already received." }, { status: 409 });
      }
      throw error;
    }
    return Response.json({ success: true, status: "pending", message: "Access request submitted for approval." }, { status: 201 });
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    if (String(error?.code || "").startsWith("auth/")) {
      return Response.json({ message: "Invalid or expired authentication." }, { status: 401 });
    }
    console.error("Admin request error:", error?.message);
    return Response.json({ message: "Unable to submit the request." }, { status: 500 });
  }
}
