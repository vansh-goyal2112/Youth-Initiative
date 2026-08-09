"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  auth,
} from "@/services/firebase";

export default function AdminLoginPage() {
  const router =
    useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleLogin(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setErrorMessage("");

      const credentials =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const token =
        await credentials.user.getIdToken();

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

      const data =
        await response.json();

      if (!response.ok) {
        await signOut(auth);

        throw new Error(
          data.message
        );
      }

      sessionStorage.setItem(
        "adminSession",
        JSON.stringify(
          data.admin
        )
      );

      router.replace(
        "/admin"
      );
    } catch (error) {
      console.error(
        "Admin login error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Invalid admin credentials."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page">

      <section className="admin-login-card">

        <div className="admin-login-icon">
          <ShieldCheck size={38} />
        </div>

        <span className="admin-login-label">
          SAIT YOUTH INITIATIVE
        </span>

        <h1>
          Administrator Login
        </h1>

        <p>
          Sign in with your authorized
          administrator account.
        </p>

        <form
          className="admin-login-form"
          onSubmit={handleLogin}
        >

          <label>
            Admin Email

            <input
              type="email"
              value={email}
              required
              autoComplete="email"
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
            />
          </label>


          <label>
            Password

            <div className="admin-password-input">

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                required
                autoComplete="current-password"
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>

            </div>
          </label>


          {errorMessage && (
            <div className="admin-login-error">
              {errorMessage}
            </div>
          )}


          <button
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={19}
                  className="button-spinner"
                />

                Signing in...
              </>
            ) : (
              <>
                <LockKeyhole
                  size={18}
                />

                Login to Admin Portal
              </>
            )}
          </button>

        </form>

      </section>

    </main>
  );
}