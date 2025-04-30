// lib/firebaseAdmin.ts
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Helper to read a required environment variable or throw an error.
 */
function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// Read and validate Firebase credentials from env
const projectId   = getEnv('FIREBASE_PROJECT_ID');
const clientEmail = getEnv('FIREBASE_CLIENT_EMAIL');
// The private key may contain literal `\n` sequences; replace them with actual newlines
//const privateKey  = getEnv('FIREBASE_PRIVATE_KEY')
// The key may be stored in two different ways:
//   1) single-line string with literal "\n" escape sequences (Vercel recommended)
//   2) multi-line string copied verbatim (e.g. when using `vercel env add` from CLI)
// We normalise both cases so that the final string contains real line-break characters.
const privateKey = getEnv("FIREBASE_PRIVATE_KEY")
  // Convert escaped newlines that come through as two characters ("\n")
  .replace(/\\n/g, "\n")
  // Convert escaped returns ("\r") as well
  .replace(/\\r/g, "\r")
  // Trim surrounding quotes that may be accidentally included when pasting
  .replace(/^"|"$/g, "");

// Initialize Firebase Admin SDK
// Initialize Firebase Admin SDK (singleton)
if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// Firestore database instance
export const db = getFirestore();