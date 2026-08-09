"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  LoaderCircle,
} from "lucide-react";

import {
  auth,
} from "@/services/firebase";

export default function AdminGuard({
  children,
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [verified, setVerified] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  useEffect(() => {
    if (
      pathname === "/admin/login"
    ) {
      setVerified(true);
      setChecking(false);
      return;
    }

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          try {
            if (!firebaseUser) {
              router.replace(
                "/admin/login"
              );

              return;
            }

            const token =
              await firebaseUser.getIdToken();

            const response =
              await fetch(
                "/api/admin/auth/verify",
                {
                  method: "POST",

                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
              );

            if (!response.ok) {
              await signOut(auth);

              router.replace(
                "/admin/login"
              );

              return;
            }

            setVerified(true);
          } catch (error) {
            console.error(
              "Admin guard error:",
              error
            );

            router.replace(
              "/admin/login"
            );
          } finally {
            setChecking(false);
          }
        }
      );

    return unsubscribe;
  }, [
    pathname,
    router,
  ]);

  if (
    pathname === "/admin/login"
  ) {
    return children;
  }

  if (
    checking ||
    !verified
  ) {
    return (
      <main className="admin-guard-loading">
        <LoaderCircle
          size={35}
          className="button-spinner"
        />

        <span>
          Verifying administrator...
        </span>
      </main>
    );
  }

  return children;
}