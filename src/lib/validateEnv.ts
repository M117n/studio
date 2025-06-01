// lib/validateEnv.ts
const requiredVars = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  ] as const;
  
  export function validateEnv() {
    const missing = requiredVars.filter((k) => !process.env[k] || process.env[k] === "");
    if (missing.length) {
      throw new Error(
        `❌ Missing Firebase env variables: ${missing.join(", ")}\n` +
        "Set them in .env.local / Vercel project settings before starting the app."
      );
    }
  } 
  