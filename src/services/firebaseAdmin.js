import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  getAppCheck,
} from "firebase-admin/app-check";

function getFirebaseAdminApp() {
  if (
    getApps().length >
    0
  ) {
    return getApps()[0];
  }

  const projectId =
    process.env
      .FIREBASE_ADMIN_PROJECT_ID;

  const clientEmail =
    process.env
      .FIREBASE_ADMIN_CLIENT_EMAIL;

  const privateKey =
    process.env
      .FIREBASE_ADMIN_PRIVATE_KEY
      ?.replace(
        /\\n/g,
        "\n"
      );

  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {
    return null;
  }

  return initializeApp({
    credential:
      cert({
        projectId,
        clientEmail,
        privateKey,
      }),
  });
}

function requireFirebaseAdminApp() {
  const app = getFirebaseAdminApp();

  if (!app) {
    throw new Error(
      "Firebase Admin environment variables are missing."
    );
  }

  return app;
}

const adminAuth = new Proxy(
  {},
  {
    get(target, prop) {
      const app = requireFirebaseAdminApp();
      const auth = getAuth(app);
      const value = auth[prop];
      return typeof value === "function" ? value.bind(auth) : value;
    },
  }
);

const adminAppCheck = new Proxy(
  {},
  {
    get(target, prop) {
      const app = requireFirebaseAdminApp();
      const appCheck = getAppCheck(app);
      const value = appCheck[prop];
      return typeof value === "function" ? value.bind(appCheck) : value;
    },
  }
);

export {
  adminAppCheck,
  adminAuth,
};