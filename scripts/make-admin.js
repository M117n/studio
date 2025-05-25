// scripts/make-admin.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK with your service account
try {
  // Use environment variables or service account directly
  // Ensure your GOOGLE_APPLICATION_CREDENTIALS environment variable is set
  // or provide the service account key path directly if not using applicationDefault()
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Your Firebase project ID from .firebaserc or Firebase console
    // projectId: process.env.FIREBASE_PROJECT_ID || 'smartstock-e8146' // It's better to use env var
  });
} catch (error) {
  console.error('Firebase initialization error:', error.message);
  console.log('Ensure GOOGLE_APPLICATION_CREDENTIALS is set or service account path is correct.');
  process.exit(1);
}

const db = getFirestore();

// Check if a UID is provided as a command-line argument
const uidFromArgs = process.argv[2];

if (!uidFromArgs) {
  console.error(' Error: No UID provided. Usage: node scripts/make-admin.js <USER_UID>');
  process.exit(1);
}

async function makeUserAdmin(uid) {
  console.log(`Attempting to make user ${uid} an admin...`);
  
  try {
    // 1. Check if user exists in Firebase Authentication
    const userRecord = await admin.auth().getUser(uid);
    console.log(`User found: ${userRecord.email || userRecord.uid} (Display Name: ${userRecord.displayName || 'N/A'})`);
    
    // 2. Set custom claims: { admin: true }
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(` Custom claim { admin: true } set for user ${uid}.`);

    // 3. Add/Update user in 'adminUsers' collection for easy listing in admin panel
    const adminUserRef = db.collection('adminUsers').doc(uid);
    const adminUserData = {
      uid: uid,
      email: userRecord.email || null, // Store email if available
      displayName: userRecord.displayName || null, // Store displayName if available
      adminSince: admin.firestore.FieldValue.serverTimestamp()
    };
    await adminUserRef.set(adminUserData, { merge: true });
    console.log(` User ${uid} added/updated in 'adminUsers' collection.`);

    // Optional: Update 'users' collection if you still use it for general user roles.
    // This part is kept from your original script but might be redundant if 'adminUsers' and custom claims are primary.
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userDataForUsersCollection = {
      role: 'admin',
      email: userRecord.email || (userDoc.exists ? userDoc.data().email : ''),
      name: userRecord.displayName || (userDoc.exists ? userDoc.data().name : 'Admin User'),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (userDoc.exists) {
      await userRef.update(userDataForUsersCollection);
      console.log(`  Updated existing user document in 'users' collection: role set to 'admin'.`);
    } else {
      await userRef.set({ uid: uid, ...userDataForUsersCollection });
      console.log(`  Created new user document in 'users' collection with role 'admin'.`);
    }
    
    console.log(` Successfully made user ${uid} an admin with custom claims and entry in 'adminUsers'.`);
    process.exit(0);
  } catch (error) {
    console.error(` Error making user admin:`, error.message);
    if (error.code === 'auth/user-not-found') {
      console.error(`Ensure the UID ${uid} corresponds to an existing Firebase Authentication user.`);
    }
    process.exit(1);
  }
}

// Call the function with the UID from arguments
makeUserAdmin(uidFromArgs);
