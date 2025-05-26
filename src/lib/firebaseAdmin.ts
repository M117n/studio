// lib/firebaseAdmin.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Helper to read a required environment variable or throw an error.
 */
function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

let dbInstance: ReturnType<typeof getFirestore>;
let authInstance: ReturnType<typeof getAuth>;

// Initialize Firebase Admin SDK only if no apps are already initialized.
if (!getApps().length) {
  console.log("Attempting to initialize Firebase Admin SDK...");
  // Read and validate Firebase credentials from env
  const projectId   = getEnv('FIREBASE_PROJECT_ID');
  const clientEmail = getEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = getEnv("FIREBASE_PRIVATE_KEY")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/^"|"$/g, "");

  try {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    // Depending on your error handling strategy, you might want to throw the error
    // or handle it in a way that prevents the app from starting/running without Firebase Admin.
  }
} else {
  console.log("Firebase Admin SDK already initialized.");
}

// Get Firestore and Auth instances. These calls are designed to be safe
// even if called multiple times, returning the existing instance.
dbInstance = getFirestore();
authInstance = getAuth();

export const db = dbInstance;
export const adminAuth = authInstance;