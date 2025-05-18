/** @jest-environment node */
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  TokenOptions,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { jest } from '@jest/globals';
import { Timestamp } from 'firebase/firestore';           // <-- already imported

// ---- TYPES -------------------------------------------------------------

// If you want static typing, uncomment the next line and add the return
// annotations.  Most people just rely on inference in their tests.
// import type { Firestore } from 'firebase/firestore';

// -----------------------------------------------------------------------

const PROJECT_ID = 'shawinv-test';
let   testEnv: RulesTestEnvironment;

jest.setTimeout(30_000);

/** Load rules and stand up the emulator */
const loadRules = async () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules, host: 'localhost', port: 8080 },
  });
};

/** Convenience helpers */
const getFirestore = (auth?: { uid: string; role?: string }) => {
  if (!testEnv) throw new Error('Test environment not initialized');

  const ctx = auth?.uid
    ? testEnv.authenticatedContext(
        auth.uid,
        auth.role ? ({ role: auth.role } as TokenOptions) : undefined,
      )
    : testEnv.unauthenticatedContext();

  return ctx.firestore();
};

const getAdminFirestore = () => {
  if (!testEnv) throw new Error('Test environment not initialized');
  return testEnv.unauthenticatedContext().firestore();
};

/** Seed data used by every test run */
const setupTestData = async () => {
  const admin = getAdminFirestore();

  await admin.collection('notifications').doc('user1Notification1').set({
    userId: 'user1',
    type: 'request_approved',
    message: 'Your request has been approved',
    requestId: 'request1',
    timestamp: Timestamp.now(),
    isRead: false,
  });

  await admin.collection('notifications').doc('user2Notification1').set({
    userId: 'user2',
    type: 'request_rejected',
    message: 'Your request has been rejected',
    requestId: 'request2',
    timestamp: Timestamp.now(),
    isRead: false,
    adminNotes: 'Not enough inventory',
  });
};

// -----------------------------------------------------------------------
//                           TEST SUITE
// -----------------------------------------------------------------------

describe('Firestore security rules – notifications', () => {
  beforeAll(async () => {
    await loadRules();
    await setupTestData();
  });

  afterAll(() => testEnv?.cleanup());

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await setupTestData();
  });

  // -------------------------------------------------------------------
  // LISTING
  // -------------------------------------------------------------------
  describe('Listing notifications', () => {
    test('Unauthenticated users cannot list notifications', async () => {
      const db = getFirestore();
      await assertFails(db.collection('notifications').get());
    });

    test('Authenticated users can list their own notifications', async () => {
      const db = getFirestore({ uid: 'user1' });
      await assertSucceeds(
        db.collection('notifications').where('userId', '==', 'user1').get(),
      );
    });

    test("Users can't list other users' notifications", async () => {
      const db = getFirestore({ uid: 'user1' });
      await assertFails(
        db.collection('notifications').where('userId', '==', 'user2').get(),
      );
    });
  });

  // -------------------------------------------------------------------
  // READING
  // -------------------------------------------------------------------
  describe('Reading specific notifications', () => {
    test('Unauthenticated users cannot read notifications', async () => {
      const db = getFirestore();
      await assertFails(db.doc('notifications/user1Notification1').get());
    });

    test('Users can read their own notifications', async () => {
      const db = getFirestore({ uid: 'user1' });
      await assertSucceeds(db.doc('notifications/user1Notification1').get());
    });

    test("Users can't read others' notifications", async () => {
      const db = getFirestore({ uid: 'user1' });
      await assertFails(db.doc('notifications/user2Notification1').get());
    });
  });

  // -------------------------------------------------------------------
  // CREATING
  // -------------------------------------------------------------------
  describe('Creating notifications', () => {
    test('Unauthenticated users cannot create', async () => {
      const db = getFirestore();
      await assertFails(
        db.doc('notifications/new').set({
          userId: 'user1',
          type: 'request_approved',
          message: 'New notification',
          requestId: 'request1',
          timestamp: Timestamp.now(),
          isRead: false,
        }),
      );
    });

    test('Regular users cannot create', async () => {
      const db = getFirestore({ uid: 'user1' });
      await assertFails(
        db.doc('notifications/new').set({
          userId: 'user1',
          type: 'request_approved',
          message: 'New notification',
          requestId: 'request1',
          timestamp: Timestamp.now(),
          isRead: false,
        }),
      );
    });

    test('Admins can create', async () => {
      const db = getFirestore({ uid: 'admin1', role: 'admin' });
      await assertSucceeds(
        db.doc('notifications/adminCreated').set({
          userId: 'user1',
          type: 'request_approved',
          message: 'Admin created notification',
          requestId: 'request1',
          timestamp: Timestamp.now(),
          isRead: false,
        }),
      );
    });
  });

  // -------------------------------------------------------------------
  // UPDATING
  // -------------------------------------------------------------------
  describe('Updating notifications', () => {
    test('Unauthenticated cannot update', async () => {
      const db = getFirestore();
      await assertFails(
        db.doc('notifications/user1Notification1').update({ isRead: true }),
      );
    });

    test('Users can mark their notification as read', async () => {
      const db = getFirestore({ uid: 'user1' });
      await assertSucceeds(
        db.doc('notifications/user1Notification1').update({ isRead: true }),
      );
    });

    test('Users cannot mark it back to unread', async () => {
      const admin = getAdminFirestore();
      await admin.doc('notifications/user1Notification1').update({ isRead: true });

      const db = getFirestore({ uid: 'user1' });
      await assertFails(
        db.doc('notifications/user1Notification1').update({ isRead: false }),
      );
    });

    // more update tests …
  });

  // -------------------------------------------------------------------
  // DELETING
  // -------------------------------------------------------------------
  describe('Deleting', () => {
    test('Nobody can delete notifications', async () => {
      const userDb  = getFirestore({ uid: 'user1' });
      const adminDb = getFirestore({ uid: 'admin', role: 'admin' });

      await assertFails(userDb.doc('notifications/user1Notification1').delete());
      await assertFails(adminDb.doc('notifications/user1Notification1').delete());
    });
  });
});
