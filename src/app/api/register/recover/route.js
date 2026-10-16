import { requireAppCheck, appCheckErrorResponse } from "@/services/appCheckServer";
import { sendAzureEmail } from "@/services/azureEmailServer";
import {
  isCosmosPreconditionFailed,
  queryCosmosDocuments,
  replaceCosmosDocument,
} from "@/services/cosmosData";
import { normalizeRecoveryEmail } from "@/services/registrationRecovery.mjs";
import { recoverPendingRegistration } from "@/services/registrationRecoveryWorkflow.mjs";

export const runtime = "nodejs";

const GENERIC_MESSAGE =
  "If an unfinished registration matches that email, we will send a new secure link to the email address already associated with the appropriate verification step. Please check your inbox and spam folder.";

function genericResponse() {
  // The API never exposes whether a student account or pending record exists.
  return Response.json({ success: true, message: GENERIC_MESSAGE });
}

/**
 * Registration recovery must work without the previous browser session.
 * App Check is required. Only the original trusted email gets a new link.
 * All account/stage-specific decisions are tested in a separate workflow.
 */
export async function POST(request) {
  try {
    await requireAppCheck(request);

    const body = await request.json().catch(() => null);
    const email = normalizeRecoveryEmail(body?.email);
    if (!email) {
      return Response.json(
        { success: false, message: "Enter a valid email address." },
        { status: 400 }
      );
    }

    await recoverPendingRegistration({
      email,
      findExistingStudents: (value) =>
        queryCosmosDocuments(
          "students",
          "SELECT TOP 1 c.id FROM c WHERE c.contactEmail = @email",
          [{ name: "@email", value }]
        ),
      findPendingRegistrations: (value) =>
        queryCosmosDocuments(
          "pendingRegistrations",
          `SELECT * FROM c WHERE c.email = @email
           AND c.status IN (
             "pending_email_verification",
             "email_verified",
             "pending_consent",
             "consent_approved"
           )`,
          [{ name: "@email", value }]
        ),
      replaceRegistration: (current, updates) =>
        replaceCosmosDocument("pendingRegistrations", current, updates),
      sendRecoveryEmail: sendAzureEmail,
      isPreconditionFailed: isCosmosPreconditionFailed,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      replyTo: process.env.EMAIL_REPLY_TO || "youth.programs@sait.ca",
      logError: (...args) => console.error(...args),
    });

    return genericResponse();
  } catch (error) {
    const appCheckResponse = appCheckErrorResponse(error);
    if (appCheckResponse) return appCheckResponse;

    console.error("Registration recovery request failed:", error);
    return genericResponse();
  }
}
