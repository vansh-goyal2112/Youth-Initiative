"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  usePathname,
} from "next/navigation";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  getToken as getAppCheckToken,
} from "firebase/app-check";

import {
  appCheck,
  auth,
} from "@/services/firebase";

const AuthContext =
  createContext();

export function AuthProvider({
  children,
}) {
  const pathname =
    usePathname();

  const isAdminRoute =
    pathname?.startsWith(
      "/admin"
    ) === true;

  const [
    user,
    setUser,
  ] =
    useState(null);

  const [
    studentProfile,
    setStudentProfile,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    let providerActive =
      true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (
            !providerActive
          ) {
            return;
          }

          /*
            Admin authentication is
            handled separately by
            AdminGuard + adminFetch.

            The student AuthContext
            must NEVER validate or
            sign out an administrator.
          */

          if (
            isAdminRoute
          ) {
            setUser(
              null
            );

            setStudentProfile(
              null
            );

            setLoading(
              false
            );

            return;
          }

          setLoading(
            true
          );

          try {
            if (
              !firebaseUser
            ) {
              setUser(
                null
              );

              setStudentProfile(
                null
              );

              return;
            }

            /*
              Firebase authentication
              remains temporarily.

              Student profile data is
              now loaded from Cosmos DB
              through the protected
              server API.
            */

            if (
              !appCheck
            ) {
              throw new Error(
                "App verification is not available."
              );
            }

            const [
              idToken,
              appCheckTokenResult,
            ] =
              await Promise.all([
                firebaseUser
                  .getIdToken(),

                getAppCheckToken(
                  appCheck
                ),
              ]);

            const profileResponse =
              await fetch(
                "/api/student/profile",
                {
                  method:
                    "GET",

                  headers: {
                    Authorization:
                      `Bearer ${idToken}`,

                    "X-Firebase-AppCheck":
                      appCheckTokenResult.token,
                  },

                  cache:
                    "no-store",
                }
              );

            const profileResult =
              await profileResponse
                .json()
                .catch(
                  () => null
                );

            /*
              The authentication state
              may have changed while the
              profile request was running.

              Do not apply stale data.
            */

            if (
              !providerActive ||
              auth.currentUser
                ?.uid !==
                firebaseUser.uid
            ) {
              return;
            }

            if (
              !profileResponse.ok ||
              profileResult?.success !==
                true ||
              !profileResult?.student
            ) {
              setUser(
                null
              );

              setStudentProfile(
                null
              );

              await signOut(
                auth
              );

              return;
            }

            const studentData =
              profileResult.student;

            const youthId =
              typeof studentData
                .youthId ===
              "string"
                ? studentData
                    .youthId
                    .trim()
                : "";

            const expectedInternalEmail =
              youthId
                ? `${youthId.toLowerCase()}@youthinitiative.local`
                : "";

            const firebaseEmail =
              typeof firebaseUser
                .email ===
              "string"
                ? firebaseUser
                    .email
                    .trim()
                    .toLowerCase()
                : "";

            const youthIdIsValid =
              Boolean(
                youthId
              ) &&
              firebaseEmail ===
                expectedInternalEmail;

            const uidMatches =
              studentData
                .firebaseUid ===
              firebaseUser.uid;

            const accountIsActive =
              studentData
                .accountStatus ===
              "active";

            const studentRoleIsValid =
              studentData.role ===
              "student";

            const parentalConsentIsValid =
              studentData
                .requiresParentalConsent !==
                true ||
              studentData
                .consentStatus ===
                "approved";

            /*
              Restored student sessions
              must pass the same important
              checks used during login.
            */

            if (
              !youthIdIsValid ||
              !uidMatches ||
              !accountIsActive ||
              !studentRoleIsValid ||
              !parentalConsentIsValid
            ) {
              setUser(
                null
              );

              setStudentProfile(
                null
              );

              await signOut(
                auth
              );

              return;
            }

            setUser(
              firebaseUser
            );

            setStudentProfile(
              {
                id:
                  studentData.id ||
                  firebaseUser.uid,

                ...studentData,
              }
            );
          } catch (
            error
          ) {
            console.error(
              "Error loading student profile:",
              error
            );

            if (
              !providerActive
            ) {
              return;
            }

            setUser(
              null
            );

            setStudentProfile(
              null
            );

            /*
              Student routes fail closed.

              Admin routes already returned
              above and are handled separately.
            */

            try {
              if (
                auth.currentUser
                  ?.uid ===
                firebaseUser
                  ?.uid
              ) {
                await signOut(
                  auth
                );
              }
            } catch (
              signOutError
            ) {
              console.error(
                "Error signing out invalid student session:",
                signOutError
              );
            }
          } finally {
            if (
              providerActive &&
              !isAdminRoute
            ) {
              setLoading(
                false
              );
            }
          }
        }
      );

    return () => {
      providerActive =
        false;

      unsubscribe();
    };
  }, [
    isAdminRoute,
  ]);

  const value = {
    user,

    studentProfile,

    updateStudentProfile: setStudentProfile,

    loading,

    isAuthenticated:
      Boolean(
        user &&
        studentProfile
      ),
  };

  return (
    <AuthContext.Provider
      value={
        value
      }
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(
      AuthContext
    );

  if (
    !context
  ) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}