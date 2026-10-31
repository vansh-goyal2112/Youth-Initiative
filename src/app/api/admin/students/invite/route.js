import { POST as registerStudent } from "@/app/api/register/route";
import {
  requireAdminPermission,
  adminAccessResponse,
} from "@/services/adminAccess";

export const runtime = "nodejs";

// Admin-assisted enrollment uses exactly the same validated student
// registration, guardian consent, email verification and activation flow.
// It MUST NOT create a Firebase user or bypass consent.
export async function POST(request) {
  try {
    await requireAdminPermission(request, "students.edit");
    const registrationResponse = await registerStudent(request);
    const result = await registrationResponse.json();

    if (!registrationResponse.ok) {
      return Response.json({
        success: false,
        message: result.message || "Student enrollment could not be started.",
        code: result.code,
        recoveryUrl: result.recoveryUrl,
        fieldErrors: result.fieldErrors,
      }, { status: registrationResponse.status });
    }

    return Response.json({
      success: true,
      registrationId: result.registrationId,
      status: "pending_activation",
      nextStep: result.nextStep,
      emailSent: result.emailSent,
      message: result.nextStep === "verify_email"
        ? "Registration initiated. The student must verify their email and activate their account before appearing in the student directory."
        : "Registration initiated. The guardian must approve consent and the student must activate the account before appearing in the student directory.",
    }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const access = adminAccessResponse(error);
    if (access) return access;
    console.error("Admin student invitation failed:", error?.message);
    return Response.json({
      success: false,
      message: "Student enrollment could not be initiated.",
    }, { status: 500 });
  }
}
