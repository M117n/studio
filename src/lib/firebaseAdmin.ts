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
const privateKey = getEnv("FIREBASE_PRIVATE_KEY")
  // Convert escaped newlines that come through as two characters ("\n")
  .replace(/\\n/g, "\n")
  // Convert escaped returns ("\r") as well
  .replace(/\\r/g, "\r")
  // Trim surrounding quotes that may be accidentally included when pasting
  .replace(/^"|"$/g, "");

// Initialize Firebase Admin SDK
if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// Firestore database instance
export const db = getFirestore();