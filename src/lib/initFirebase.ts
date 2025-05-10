import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// NOTE: This file is only used on the client. All variables exposed via the
// `env` section of `next.config.js` are prefixed with `PUBLIC_`, so we read the
// same key here. The previous `NPUBLIC_FIREBASE_API_KEY` was a typo that
// prevented Firebase from initialising correctly in the browser.

const isProd = process.env.NODE_ENV === "production";
console.log(`Firebase running in ${isProd ? "PRODUCTION" : "DEVELOPMENT"} mode`);

const clientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log(`Using Firebase project: ${clientConfig.projectId}`);

if (!getApps().length) {
  initializeApp(clientConfig);
}

export const auth = getAuth();