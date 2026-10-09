import {
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";

import {
  getAuth,
} from "firebase/auth";

import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey:
    process.env
      .NEXT_PUBLIC_FIREBASE_API_KEY,

  authDomain:
    process.env
      .NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,

  projectId:
    process.env
      .NEXT_PUBLIC_FIREBASE_PROJECT_ID,

  storageBucket:
    process.env
      .NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,

  messagingSenderId:
    process.env
      .NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,

  appId:
    process.env
      .NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        firebaseConfig
      );

let appCheck = null;

/*
  App Check runs only in the browser.
*/
if (
  typeof window !==
  "undefined"
) {
  const siteKey =
    process.env
      .NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;

  if (siteKey) {
    /*
      Local development only.

      Firebase generates a debug token
      that must be registered in the
      Firebase App Check console.
    */
    if (
      process.env.NODE_ENV ===
      "development"
    ) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN =
        true;
    }

    /*
      Next.js Fast Refresh can execute this
      module again during development.

      Keep one App Check instance globally
      so initializeAppCheck() is not called
      repeatedly for the same Firebase app.
    */
    if (
      !globalThis
        .__youthInitiativeAppCheck
    ) {
      globalThis
        .__youthInitiativeAppCheck =
        initializeAppCheck(
          app,
          {
            provider:
              new ReCaptchaEnterpriseProvider(
                siteKey
              ),

            isTokenAutoRefreshEnabled:
              true,
          }
        );
    }

    appCheck =
      globalThis
        .__youthInitiativeAppCheck;
  }
}

/*
  Firebase Authentication remains
  temporarily during the migration.

  Firestore has been removed because
  application data now uses Cosmos DB.
*/
const auth =
  getAuth(app);

export {
  app,
  appCheck,
  auth,
};