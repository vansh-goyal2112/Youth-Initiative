import {
  requireActiveStudent,
  studentAccessResponse,
} from "@/services/studentAccess";

import {
  cosmosNow,
  isCosmosPreconditionFailed,
  readCosmosDocument,
  replaceCosmosDocument,
} from "@/services/cosmosData";

import { validateReflection } from "@/services/skillQuestEngagement.mjs";

export const runtime = "nodejs";

/**
 * Store one short, structured learning reflection per verified completion.
 * Never accept free text, identifiers, XP amounts, or arbitrary fields.
 * The registration document is authoritative for attendance and ownership.
 */
export async function POST(request) {
  try {
    const { uid } = await requireActiveStudent(request);
    const body = await request.json().catch(() => null);
    const registrationId = body?.registrationId;
    const mood = body?.mood;
    const moment = body?.moment;

    if (
      typeof registrationId !== "string" ||
      registrationId.length > 120 ||
      !validateReflection({ mood, moment })
    ) {
      return Response.json(
        { success: false, message: "Choose how you felt and what you learned." },
        { status: 400 }
      );
    }

    const registration = await readCosmosDocument("registrations", registrationId);

    // 404 avoids disclosing details of another student's registration.
    if (!registration || registration.studentId !== uid) {
      return Response.json(
        { success: false, message: "Workshop record not found." },
        { status: 404 }
      );
    }

    if (
      registration.status !== "completed" ||
      registration.attendanceStatus !== "verified"
    ) {
      return Response.json(
        { success: false, message: "Finish a verified workshop before reflecting." },
        { status: 403 }
      );
    }

    // One stamp per completed workshop; repeated submissions are idempotent.
    if (registration.reflection?.completedAt) {
      return Response.json({
        success: true,
        alreadyCompleted: true,
        reflection: registration.reflection,
        message: "This workshop is already in your learning journal.",
      });
    }

    const reflection = {
      mood,
      moment,
      completedAt: cosmosNow(),
    };

    try {
      await replaceCosmosDocument("registrations", registration, {
        reflection,
        updatedAt: cosmosNow(),
      });
    } catch (error) {
      if (isCosmosPreconditionFailed(error)) {
        const latest = await readCosmosDocument("registrations", registrationId);
        if (latest?.reflection?.completedAt && latest.studentId === uid) {
          return Response.json({
            success: true,
            alreadyCompleted: true,
            reflection: latest.reflection,
          });
        }

        return Response.json(
          { success: false, message: "Your workshop updated. Please try again." },
          { status: 409 }
        );
      }
      throw error;
    }

    return Response.json({
      success: true,
      alreadyCompleted: false,
      reflection,
      message: "Reflection saved! You earned a learning journal stamp.",
    });
  } catch (error) {
    const accessResponse = studentAccessResponse(error);
    if (accessResponse) return accessResponse;
    console.error("Save workshop reflection error:", error);
    return Response.json(
      { success: false, message: "Could not save your reflection. Try again." },
      { status: 500 }
    );
  }
}
