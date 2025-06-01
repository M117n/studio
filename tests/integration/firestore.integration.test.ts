/** @jest-environment node */
import path from 'path';
import fs from 'fs'; // Needed to read the rules file
import { jest } from '@jest/globals';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, addDoc } from 'firebase/firestore';

// Increase timeout for integration tests
jest.setTimeout(30000);

// --- Keep your existing Admin SDK setup and tests if needed ---
// Load Firebase credentials and set environment variables before importing db
const serviceAccountPath = path.resolve(__dirname, '..', '..', 'smartstock-e8146-firebase-adminsdk-fbsvc-38e06d382c.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require(serviceAccountPath);
process.env.FIREBASE_PROJECT_ID = serviceAccount.project_id;
process.env.FIREBASE_CLIENT_EMAIL = serviceAccount.client_email;
process.env.FIREBASE_PRIVATE_KEY = serviceAccount.private_key;

// Import Firestore instance after env vars are set
import { db as adminDb } from '@/lib/firebaseAdmin'; // Renamed to adminDb to avoid conflict

describe('Firestore Admin SDK integration tests', () => {
  // ... your existing tests using adminDb ...
  const testCollection = 'test_integration_admin_sdk'; // Use a different collection name
  let docRefAdmin: FirebaseFirestore.DocumentReference;

  it('should connect to Firestore (Admin SDK)', async () => {
    const collections = await adminDb.listCollections();
    expect(Array.isArray(collections)).toBe(true);
  });

  it('should write and read a document correctly (Admin SDK)', async () => {
    const data = { message: 'hello integration admin' };
    docRefAdmin = adminDb.collection(testCollection).doc(); // Corrected: use adminDb here
    await docRefAdmin.set(data);
    const snapshot = await docRefAdmin.get();
    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()).toEqual(data);
  });

  afterAll(async () => {
    if (docRefAdmin) {
      await docRefAdmin.delete();
    }
  });
});
// --- End of existing Admin SDK tests ---


// --- New tests for Firestore Security Rules ---
const FIRESTORE_PROJECT_ID = serviceAccount.project_id || `rules-spec-${Date.now()}`; // Use your project ID or a unique one
const COVERAGE_URL = `http://127.0.0.1:8080/emulator/v1/projects/${FIRESTORE_PROJECT_ID}:ruleCoverage.html`;

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  try {
    testEnv = await initializeTestEnvironment({
      projectId: FIRESTORE_PROJECT_ID,
      firestore: {
        rules: fs.readFileSync(path.resolve(__dirname, '..', '..', 'firestore.rules'), 'utf8'),
        host: '127.0.0.1', // Explicitly set for clarity, default is localhost
        port: 8080,       // Default Firestore emulator port
      },
    });
  } catch (error) {
    console.error('Error initializing test environment:', error);
    process.exit(1);
  }
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
  console.log(`View rule coverage information at ${COVERAGE_URL}\n`);
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

describe('Firestore Security Rules: adminUsers collection', () => {
  const adminUsersPath = 'adminUsers';
  const testAdminId = 'testAdminUser123';
  const testNonAdminId = 'testNonAdminUser456';
  const testData = { email: 'admin@example.com', displayName: 'Test Admin', uid: testAdminId }; // Added uid for consistency

  it('Authenticated non-admin CANNOT create an adminUser document', async () => {
    const nonAdminUser = testEnv.authenticatedContext(testNonAdminId);
    const db = nonAdminUser.firestore();
    await assertFails(setDoc(doc(db, adminUsersPath, testAdminId), testData));
  });

  it('Admin CANNOT create an adminUser document (client-side)', async () => {
    const adminUser = testEnv.authenticatedContext('masterAdminUID', { admin: true }); 
    const db = adminUser.firestore();
    await assertFails(setDoc(doc(db, adminUsersPath, testAdminId), testData));
  });
  
  it('Unauthenticated user CANNOT create an adminUser document', async () => {
    const unauthedUser = testEnv.unauthenticatedContext();
    const db = unauthedUser.firestore();
    await assertFails(setDoc(doc(db, adminUsersPath, testAdminId), testData));
  });

  it('Authenticated user CAN get an adminUser document', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const unrestrictedDb = context.firestore();
      await setDoc(doc(unrestrictedDb, adminUsersPath, testAdminId), testData);
    });
    const nonAdminUser = testEnv.authenticatedContext(testNonAdminId);
    const db = nonAdminUser.firestore();
    await assertSucceeds(getDoc(doc(db, adminUsersPath, testAdminId)));
  });

  it('Authenticated user CAN list adminUser documents', async () => {
    const nonAdminUser = testEnv.authenticatedContext(testNonAdminId);
    const db = nonAdminUser.firestore();
    await assertSucceeds(getDocs(collection(db, adminUsersPath)));
  });
  
  it('Unauthenticated user CANNOT get an adminUser document', async () => {
    const unauthedUser = testEnv.unauthenticatedContext();
    const db = unauthedUser.firestore();
    // Ensure data exists for a meaningful fail on get if rules prevent it
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const unrestrictedDb = context.firestore();
      await setDoc(doc(unrestrictedDb, adminUsersPath, testAdminId), testData);
    });
    await assertFails(getDoc(doc(db, adminUsersPath, testAdminId)));
  });

  it('Authenticated non-admin CANNOT delete an adminUser document', async () => {
    // Ensure data exists to attempt deletion
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const unrestrictedDb = context.firestore();
      await setDoc(doc(unrestrictedDb, adminUsersPath, testAdminId), testData);
    });
    const nonAdminUser = testEnv.authenticatedContext(testNonAdminId);
    const db = nonAdminUser.firestore();
    await assertFails(deleteDoc(doc(db, adminUsersPath, testAdminId)));
  });
});


describe('Firestore Security Rules: actionLogs collection', () => {
  const actionLogsPath = 'actionLogs';
  const testAdminAuthId = 'actualAdminUID'; // UID of a user who would have admin claims
  const testNonAdminAuthId = 'someUserUID';
  const logData = { action: 'test_log', timestamp: new Date(), userId: testAdminAuthId }; // Added userId for context

  it('Admin CAN create an actionLog document', async () => {
    const adminUser = testEnv.authenticatedContext(testAdminAuthId, { admin: true });
    const db = adminUser.firestore();
    await assertSucceeds(addDoc(collection(db, actionLogsPath), logData));
  });

  it('Authenticated non-admin CANNOT create an actionLog document', async () => {
    const nonAdminUser = testEnv.authenticatedContext(testNonAdminAuthId);
    const db = nonAdminUser.firestore();
    await assertFails(addDoc(collection(db, actionLogsPath), logData));
  });

  it('Unauthenticated user CANNOT create an actionLog document', async () => {
    const unauthedUser = testEnv.unauthenticatedContext();
    const db = unauthedUser.firestore();
    await assertFails(addDoc(collection(db, actionLogsPath), logData));
  });

  it('Admin CAN read actionLog documents', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const unrestrictedDb = context.firestore();
        await addDoc(collection(unrestrictedDb, actionLogsPath), logData);
    });
    const adminUser = testEnv.authenticatedContext(testAdminAuthId, { admin: true });
    const db = adminUser.firestore();
    await assertSucceeds(getDocs(collection(db, actionLogsPath)));
  });
  
  it('Authenticated non-admin CANNOT read actionLog documents', async () => {
    // Ensure data exists
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const unrestrictedDb = context.firestore();
        await addDoc(collection(unrestrictedDb, actionLogsPath), logData);
    });
    const nonAdminUser = testEnv.authenticatedContext(testNonAdminAuthId);
    const db = nonAdminUser.firestore();
    await assertFails(getDocs(collection(db, actionLogsPath)));
  });

  it('Unauthenticated user CANNOT read actionLog documents', async () => {
    // Ensure data exists
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const unrestrictedDb = context.firestore();
        await addDoc(collection(unrestrictedDb, actionLogsPath), logData);
    });
    const unauthedUser = testEnv.unauthenticatedContext();
    const db = unauthedUser.firestore();
    await assertFails(getDocs(collection(db, actionLogsPath)));
  });

  it('Admin CANNOT update an actionLog document', async () => {
    let createdLogId = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const unrestrictedDb = context.firestore();
        const ref = await addDoc(collection(unrestrictedDb, actionLogsPath), logData);
        createdLogId = ref.id;
    });

    const adminUser = testEnv.authenticatedContext(testAdminAuthId, { admin: true });
    const db = adminUser.firestore();
    await assertFails(setDoc(doc(db, actionLogsPath, createdLogId), { ...logData, updated: true }));
  });

  it('Admin CANNOT delete an actionLog document', async () => {
    let createdLogId = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const unrestrictedDb = context.firestore();
        const ref = await addDoc(collection(unrestrictedDb, actionLogsPath), logData);
        createdLogId = ref.id;
    });
    const adminUser = testEnv.authenticatedContext(testAdminAuthId, { admin: true });
    const db = adminUser.firestore();
    await assertFails(deleteDoc(doc(db, actionLogsPath, createdLogId)));
  });
});