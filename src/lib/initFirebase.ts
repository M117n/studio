import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// NOTE: This file is only used on the client. All variables exposed via the
// `env` section of `next.config.js` are prefixed with `PUBLIC_`, so we read the
// same key here. The previous `NPUBLIC_FIREBASE_API_KEY` was a typo that
// prevented Firebase from initialising correctly in the browser.
const clientConfig = {
  apiKey: process.env.PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID!,
};

if (!getApps().length) {
  initializeApp(clientConfig);
}

export const auth = getAuth();