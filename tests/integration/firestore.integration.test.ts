/** @jest-environment node */
import path from 'path';
import { jest } from '@jest/globals';
// Increase timeout for integration tests
jest.setTimeout(30000);

// Load Firebase credentials and set environment variables before importing db
const serviceAccountPath = path.resolve(__dirname, '..', '..', 'smartstock-e8146-firebase-adminsdk-fbsvc-38e06d382c.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require(serviceAccountPath);
process.env.FIREBASE_PROJECT_ID = serviceAccount.project_id;
process.env.FIREBASE_CLIENT_EMAIL = serviceAccount.client_email;
process.env.FIREBASE_PRIVATE_KEY = serviceAccount.private_key;

// Import Firestore instance after env vars are set
import { db } from '@/lib/firebaseAdmin';

describe('Firestore integration tests', () => {
  const testCollection = 'test_integration';
  let docRef: FirebaseFirestore.DocumentReference;

  it('should connect to Firestore', async () => {
    const collections = await db.listCollections();
    expect(Array.isArray(collections)).toBe(true);
  });

  it('should write and read a document correctly', async () => {
    const data = { message: 'hello integration' };
    docRef = db.collection(testCollection).doc();
    const startWrite = Date.now();
    await docRef.set(data);
    const writeTime = Date.now() - startWrite;
    expect(typeof writeTime).toBe('number');
    expect(writeTime).toBeGreaterThanOrEqual(0);

    const startRead = Date.now();
    const snapshot = await docRef.get();
    const readTime = Date.now() - startRead;
    expect(typeof readTime).toBe('number');
    expect(readTime).toBeGreaterThanOrEqual(0);

    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()).toEqual(data);
  });

  afterAll(async () => {
    if (docRef) {
      await docRef.delete();
    }
    // Optionally delete the test collection document
  });
});