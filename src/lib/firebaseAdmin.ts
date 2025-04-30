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
const privateKey  = getEnv('FIREBASE_PRIVATE_KEY')
                     .replace(/\\n/g, '\n')
                     .replace(/\\r/g, '\r');

// Initialize Firebase Admin SDK
// Initialize Firebase Admin SDK (singleton)
if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// Firestore database instance
export const db = getFirestore();