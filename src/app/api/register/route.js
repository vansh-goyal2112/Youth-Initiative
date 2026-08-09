import crypto from "crypto";

import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";

import { adminDb } from "@/services/firebaseAdmin";
import {
  calculateAge,
  registrationSchema,
} from "@/validations/registrationSchema";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request) {
  try {
    const requestBody = await request.json();

    const validatedData =
      await registrationSchema.validate(requestBody, {
        abortEarly: false,
        stripUnknown: true,
      });

    const firstName = normalizeName(
      validatedData.firstName
    );

    const lastName = normalizeName(
      validatedData.lastName
    );

    const email = validatedData.email
      .trim()
      .toLowerCase();

    const dateOfBirth = validatedData.dateOfBirth;
    const age = calculateAge(dateOfBirth);
    const requiresParentalConsent = age < 18;

    /*
      Check whether this email already has an active or
      pending registration.
    */

    const pendingRegistrationQuery = await adminDb
      .collection("pendingRegistrations")
      .where("email", "==", email)
      .where(
        "status",
        "in",
        ["pending_consent", "consent_approved"]
      )
      .limit(1)
      .get();

    if (!pendingRegistrationQuery.empty) {
      return Response.json(
        {
          success: false,
          message:
            "A registration is already pending for this email address. Please check your email for the consent link.",
          code: "registration-already-pending",
        },
        {
          status: 409,
        }
      );
    }

    const studentQuery = await adminDb
      .collection("students")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!studentQuery.empty) {
      return Response.json(
        {
          success: false,
          message:
            "An account already exists with this email address. Please use the Login or Forgot Password option.",
          code: "account-already-exists",
        },
        {
          status: 409,
        }
      );
    }

    const consentToken = crypto
      .randomBytes(32)
      .toString("hex");

    const consentTokenHash = crypto
      .createHash("sha256")
      .update(consentToken)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + 30 * 60 * 1000
    );

    const pendingRegistrationReference = adminDb
      .collection("pendingRegistrations")
      .doc();

    await pendingRegistrationReference.set({
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email,
      dateOfBirth,
      age,

      requiresParentalConsent,
      consentStatus: "pending",
      status: "pending_consent",

      consentTokenHash,
      consentExpiresAt: expiresAt,
      consentApprovedAt: null,

      youthId: null,
      firebaseUid: null,

      emailStatus: "pending",
      emailSentAt: null,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const consentUrl =
      `${appUrl}/consent/${pendingRegistrationReference.id}` +
      `?token=${encodeURIComponent(consentToken)}`;

    const safeFirstName = escapeHtml(firstName);
    const safeLastName = escapeHtml(lastName);
    const safeFullName =
      `${safeFirstName} ${safeLastName}`;

    const emailResult = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ||
        "SAIT Youth Initiative <onboarding@resend.dev>",

      to: [email],

      subject:
        "Parental Consent Required – SAIT Youth Initiative",

      html: `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
          </head>

          <body
            style="
              margin: 0;
              padding: 0;
              background: #f4f5f7;
              font-family: Arial, Helvetica, sans-serif;
              color: #222222;
            "
          >
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              style="background: #f4f5f7; padding: 30px 14px;"
            >
              <tr>
                <td align="center">
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    style="
                      max-width: 620px;
                      overflow: hidden;
                      background: #ffffff;
                      border: 1px solid #e1e5ea;
                      border-radius: 14px;
                    "
                  >
                    <tr>
                      <td
                        style="
                          padding: 25px 30px;
                          border-bottom: 4px solid #e2232a;
                        "
                      >
                        <div
                          style="
                            color: #e2232a;
                            font-size: 34px;
                            font-weight: 900;
                            letter-spacing: -2px;
                          "
                        >
                          SAIT
                        </div>

                        <div
                          style="
                            margin-top: 4px;
                            color: #555555;
                            font-size: 13px;
                            font-weight: 700;
                          "
                        >
                          Youth Initiative
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding: 32px 30px;">
                        <h1
                          style="
                            margin: 0 0 20px;
                            font-size: 26px;
                            line-height: 1.25;
                          "
                        >
                          Parental Consent Request
                        </h1>

                        <p
                          style="
                            margin: 0 0 16px;
                            color: #555555;
                            font-size: 16px;
                            line-height: 1.65;
                          "
                        >
                          Hello Parent or Guardian,
                        </p>

                        <p
                          style="
                            margin: 0 0 17px;
                            color: #555555;
                            font-size: 16px;
                            line-height: 1.65;
                          "
                        >
                          <strong>${safeFullName}</strong>
                          has started creating an account on the
                          SAIT Youth Initiative learning platform.
                        </p>

                        <p
                          style="
                            margin: 0 0 25px;
                            color: #555555;
                            font-size: 16px;
                            line-height: 1.65;
                          "
                        >
                          Please review and provide consent before
                          the student account can be activated.
                        </p>

                        <a
                          href="${consentUrl}"
                          style="
                            display: inline-block;
                            padding: 15px 25px;
                            border-radius: 8px;
                            background: #e2232a;
                            color: #ffffff;
                            font-size: 15px;
                            font-weight: 700;
                            text-decoration: none;
                          "
                        >
                          Provide Consent
                        </a>

                        <p
                          style="
                            margin: 25px 0 0;
                            color: #7a7a7a;
                            font-size: 13px;
                            line-height: 1.55;
                          "
                        >
                          This prototype consent link expires in
                          30 minutes and can only be used for this
                          registration.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td
                        style="
                          padding: 18px 30px;
                          background: #f7f8fa;
                          color: #858585;
                          font-size: 12px;
                          line-height: 1.5;
                        "
                      >
                        This is an MVP demonstration of the SAIT
                        Youth Initiative registration workflow.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (emailResult.error) {
      await pendingRegistrationReference.update({
        emailStatus: "failed",
        emailError:
          emailResult.error.message ||
          "Email could not be sent.",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return Response.json(
        {
          success: false,
          message:
            "Your registration was saved, but the consent email could not be sent. Please try again.",
          code: "email-send-failed",
        },
        {
          status: 500,
        }
      );
    }

    await pendingRegistrationReference.update({
      emailStatus: "sent",
      emailId: emailResult.data?.id || null,
      emailSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json(
      {
        success: true,
        message: "Consent email sent successfully.",
        registrationId:
          pendingRegistrationReference.id,
        email,
        firstName,
        requiresParentalConsent,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Registration API error:", error);

    if (error?.name === "ValidationError") {
      return Response.json(
        {
          success: false,
          message:
            "Please correct the information entered and try again.",
          fieldErrors: error.inner?.reduce(
            (errors, validationError) => {
              if (
                validationError.path &&
                !errors[validationError.path]
              ) {
                errors[validationError.path] =
                  validationError.message;
              }

              return errors;
            },
            {}
          ),
        },
        {
          status: 400,
        }
      );
    }

    return Response.json(
      {
        success: false,
        message:
          "We could not complete your registration. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}