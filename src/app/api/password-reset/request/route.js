import crypto from "crypto";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import { Resend } from "resend";

import { adminDb } from "@/services/firebaseAdmin";

export const runtime = "nodejs";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

export async function POST(request) {
  try {
    const { youthId } =
      await request.json();

    const cleanedYouthId =
      youthId
        ?.trim()
        .toUpperCase();

    if (!cleanedYouthId) {
      return Response.json(
        {
          success: false,
          message:
            "Youth Initiative ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const studentQuery =
      await adminDb
        .collection("students")
        .where(
          "youthId",
          "==",
          cleanedYouthId
        )
        .limit(1)
        .get();

    if (studentQuery.empty) {
      return Response.json(
        {
          success: false,
          message:
            "We could not find an account with that Youth Initiative ID.",
        },
        {
          status: 404,
        }
      );
    }

    const studentDocument =
      studentQuery.docs[0];

    const student =
      studentDocument.data();

    if (!student.contactEmail) {
      return Response.json(
        {
          success: false,
          message:
            "No verification email is available for this account.",
        },
        {
          status: 400,
        }
      );
    }

    const rawToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    const tokenHash =
      crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

    const expiresAt =
      Timestamp.fromDate(
        new Date(
          Date.now() +
            30 * 60 * 1000
        )
      );

    const resetReference =
      adminDb
        .collection(
          "passwordResetRequests"
        )
        .doc();

    await resetReference.set({
      studentId:
        studentDocument.id,

      youthId:
        student.youthId,

      contactEmail:
        student.contactEmail,

      tokenHash,

      parentVerified: false,

      status:
        "pending_verification",

      expiresAt,

      usedAt: null,

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    const appUrl =
      process.env
        .NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const verificationUrl =
      `${appUrl}/parental-verification/${resetReference.id}` +
      `?token=${encodeURIComponent(rawToken)}`;

    const result =
      await resend.emails.send({
        from:
          process.env.EMAIL_FROM ||
          "SAIT Youth Initiative <onboarding@resend.dev>",

        to: [
          student.contactEmail,
        ],

        subject:
          "Password Reset Verification – SAIT Youth Initiative",

        html: `
          <div style="
            font-family:Arial,sans-serif;
            max-width:580px;
            margin:auto;
            padding:30px;
            color:#172033;
          ">

            <div style="
              border-bottom:4px solid #e2232a;
              padding-bottom:18px;
              margin-bottom:25px;
            ">
              <strong style="
                font-size:32px;
                color:#e2232a;
              ">
                SAIT
              </strong>

              <div style="
                font-size:13px;
                margin-top:3px;
              ">
                Youth Initiative
              </div>
            </div>

            <h1 style="
              font-size:25px;
            ">
              Password Reset Request
            </h1>

            <p style="
              color:#667487;
              line-height:1.7;
            ">
              A password reset was requested
              for ${student.firstName}'s
              Youth Initiative account.
            </p>

            <p style="
              color:#667487;
              line-height:1.7;
            ">
              Please verify that you are the
              parent or guardian before a new
              password can be created.
            </p>

            <a
              href="${verificationUrl}"
              style="
                display:inline-block;
                margin-top:14px;
                padding:14px 22px;
                background:#e2232a;
                color:white;
                border-radius:8px;
                text-decoration:none;
                font-weight:bold;
              "
            >
              Verify Password Reset
            </a>

            <p style="
              margin-top:25px;
              color:#87919d;
              font-size:12px;
            ">
              This link expires in 30 minutes.
            </p>

          </div>
        `,
      });

    if (result.error) {
      throw new Error(
        result.error.message
      );
    }

    return Response.json({
      success: true,

      requestId:
        resetReference.id,

      message:
        "Verification email sent.",
    });
  } catch (error) {
    console.error(
      "Password reset request error:",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Password reset request could not be completed.",
      },
      {
        status: 500,
      }
    );
  }
}