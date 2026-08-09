import crypto from "crypto";

import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/services/firebaseAdmin";

export const runtime = "nodejs";

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function createYouthId(firstName, lastName, dateOfBirth) {
  const firstInitial = firstName
    .charAt(0)
    .toUpperCase();

  const lastLetters = lastName
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, "X");

  const [year, month, day] = dateOfBirth.split("-");

  const randomDigits = crypto
    .randomInt(1000, 10000)
    .toString();

  return `${firstInitial}${lastLetters}${day}${month}${randomDigits}`;
}

async function generateUniqueYouthId(
  firstName,
  lastName,
  dateOfBirth
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const youthId = createYouthId(
      firstName,
      lastName,
      dateOfBirth
    );

    const existingStudent = await adminDb
      .collection("students")
      .where("youthId", "==", youthId)
      .limit(1)
      .get();

    if (existingStudent.empty) {
      return youthId;
    }
  }

  throw new Error(
    "A unique Youth Initiative ID could not be generated."
  );
}

function validatePassword(password, registration) {
  if (typeof password !== "string") {
    return "Password is required.";
  }

  if (password.length < 10 || password.length > 64) {
    return "Password must contain between 10 and 64 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain an uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain a lowercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain a number.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain a special character.";
  }

  const passwordLower = password.toLowerCase();

  if (
    passwordLower.includes(
      registration.firstName.toLowerCase()
    ) ||
    passwordLower.includes(
      registration.lastName.toLowerCase()
    )
  ) {
    return "Password cannot contain the student's name.";
  }

  return null;
}

export async function POST(request) {
  let createdUser = null;

  try {
    const {
      registrationId,
      token,
      password,
      confirmPassword,
    } = await request.json();

    if (
      !registrationId ||
      !token ||
      !password ||
      !confirmPassword
    ) {
      return Response.json(
        {
          success: false,
          message: "All password fields are required.",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return Response.json(
        {
          success: false,
          message: "Passwords do not match.",
        },
        { status: 400 }
      );
    }

    const registrationReference = adminDb
      .collection("pendingRegistrations")
      .doc(registrationId);

    const registrationSnapshot =
      await registrationReference.get();

    if (!registrationSnapshot.exists) {
      return Response.json(
        {
          success: false,
          message: "The registration could not be found.",
        },
        { status: 404 }
      );
    }

    const registration = registrationSnapshot.data();

    if (registration.status === "account_created") {
      return Response.json(
        {
          success: false,
          message: "This account has already been activated.",
        },
        { status: 409 }
      );
    }

    const providedTokenHash = hashToken(token);

    if (
      providedTokenHash !== registration.consentTokenHash
    ) {
      return Response.json(
        {
          success: false,
          message: "The consent token is invalid.",
        },
        { status: 401 }
      );
    }

    const expiryDate =
      registration.consentExpiresAt?.toDate?.() ||
      new Date(registration.consentExpiresAt);

    if (expiryDate.getTime() < Date.now()) {
      return Response.json(
        {
          success: false,
          message: "The consent link has expired.",
        },
        { status: 410 }
      );
    }

    const passwordError = validatePassword(
      password,
      registration
    );

    if (passwordError) {
      return Response.json(
        {
          success: false,
          message: passwordError,
        },
        { status: 400 }
      );
    }

    const youthId = await generateUniqueYouthId(
      registration.firstName,
      registration.lastName,
      registration.dateOfBirth
    );

    const internalEmail =
      `${youthId.toLowerCase()}@youthinitiative.local`;

    createdUser = await adminAuth.createUser({
      email: internalEmail,
      password,
      displayName:
        `${registration.firstName} ${registration.lastName}`,
      emailVerified: true,
      disabled: false,
    });

    const batch = adminDb.batch();

    const studentReference = adminDb
      .collection("students")
      .doc(createdUser.uid);

    batch.set(studentReference, {
      firebaseUid: createdUser.uid,

      firstName: registration.firstName,
      lastName: registration.lastName,
      fullName:
        `${registration.firstName} ${registration.lastName}`,

      contactEmail: registration.email,
      internalEmail,
      youthId,
      dateOfBirth: registration.dateOfBirth,

      role: "student",
      accountStatus: "active",
      consentStatus: "approved",

      learningMode: null,
      interests: [],
      onboardingCompleted: false,

      totalXp: 0,
      level: 1,
      badgeCount: 0,
      completedWorkshopCount: 0,
      currentStreak: 0,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: null,
    });

    batch.update(registrationReference, {
      firebaseUid: createdUser.uid,
      youthId,
      internalEmail,

      consentStatus: "approved",
      status: "account_created",

      consentApprovedAt:
        FieldValue.serverTimestamp(),

      accountCreatedAt:
        FieldValue.serverTimestamp(),

      updatedAt: FieldValue.serverTimestamp(),

      consentTokenHash: null,
    });

    await batch.commit();

    return Response.json(
      {
        success: true,
        youthId,
        firstName: registration.firstName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Account activation error:", error);

    if (createdUser?.uid) {
      try {
        await adminAuth.deleteUser(createdUser.uid);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up Auth user:",
          cleanupError
        );
      }
    }

    return Response.json(
      {
        success: false,
        message:
          error?.code === "auth/email-already-exists"
            ? "An account has already been created for this registration."
            : "The account could not be activated. Please try again.",
      },
      { status: 500 }
    );
  }
}