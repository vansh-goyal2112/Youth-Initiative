// Firebase Admin generates the reset action code; our own admin reset page
// validates and consumes it using the Firebase client SDK.
export function adminResetActionUrl(firebaseActionLink, appUrl) {
  const action = new URL(firebaseActionLink);
  // Some Firebase action links wrap the actual action in a "link" parameter.
  const inner = action.searchParams.get("link");
  const verifiedAction = inner ? new URL(inner) : action;
  if (verifiedAction.protocol !== "https:" ||
      verifiedAction.searchParams.get("mode") !== "resetPassword") {
    throw new Error("Firebase did not return a password-reset action.");
  }
  const code = verifiedAction.searchParams.get("oobCode");
  if (!code || code.length > 4096) {
    throw new Error("Firebase returned a reset link without a usable action code.");
  }
  if (typeof appUrl !== "string" || !appUrl.trim()) {
    throw new Error("NEXT_PUBLIC_APP_URL must be configured for admin recovery.");
  }
  const base = new URL(appUrl);
  const localDev = process.env.NODE_ENV !== "production" &&
    base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname);
  if ((base.protocol !== "https:" && !localDev) ||
      base.username || base.password || base.search || base.hash) {
    throw new Error("The configured application URL is not safe for password reset.");
  }
  const destination = new URL("/admin/reset-password", base);
  destination.searchParams.set("oobCode", code);
  return destination.toString();
}

export function isValidAdminRecoveryPassword(password) {
  return typeof password === "string" && password.length >= 12 &&
    password.length <= 64 && /[A-Z]/.test(password) &&
    /[a-z]/.test(password) && /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}
