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

import { isValidQuestId } from "@/services/skillQuestEngagement.mjs";

export const runtime = "nodejs";

/** A student's personal focus is a choice, not a separate XP award. */
export async function POST(request) {
  try {
    const { uid } = await requireActiveStudent(request);
    const body = await request.json().catch(() => null);
    const questId = body?.questId;

    if (!isValidQuestId(questId)) {
      return Response.json(
        { success: false, message: "Choose a valid Skill Quest mission." },
        { status: 400 }
      );
    }

    const student = await readCosmosDocument("students", uid);
    if (!student || student.role !== "student" || student.accountStatus !== "active") {
      return Response.json(
        { success: false, message: "Student account unavailable." },
        { status: 403 }
      );
    }

    if (student.activeQuestId === questId) {
      return Response.json({ success: true, activeQuestId: questId });
    }

    try {
      await replaceCosmosDocument("students", student, {
        activeQuestId: questId,
        updatedAt: cosmosNow(),
      });
    } catch (error) {
      if (isCosmosPreconditionFailed(error)) {
        return Response.json(
          { success: false, message: "Your profile changed. Try choosing again." },
          { status: 409 }
        );
      }
      throw error;
    }

    return Response.json({
      success: true,
      activeQuestId: questId,
      message: "Mission selected! Your quest is ready.",
    });
  } catch (error) {
    const accessResponse = studentAccessResponse(error);
    if (accessResponse) return accessResponse;

    console.error("Select Skill Quest focus error:", error);
    return Response.json(
      { success: false, message: "Could not save your mission." },
      { status: 500 }
    );
  }
}
