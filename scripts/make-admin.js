// scripts/make-admin.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK with your service account
try {
  // Use environment variables or service account directly
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Your Firebase project ID from .firebaserc
    projectId: 'smartstock-e8146'
  });
} catch (error) {
  console.error('Firebase initialization error:', error);
  process.exit(1);
}

const db = getFirestore();
const uid = '9CuI7xQ8FPOscSoArVX3aC3SPoZ2';

async function makeUserAdmin(uid) {
  console.log(`Setting user ${uid} as admin...`);
  
  try {
    // First, check if user exists in Authentication
    const userRecord = await admin.auth().getUser(uid);
    console.log(`User ${userRecord.email || userRecord.uid} found in Authentication`);
    
    // Get the user document reference
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    // If user document exists, update it; otherwise create it
    if (userDoc.exists) {
      await userRef.update({ role: 'admin' });
      console.log(`Updated existing user document: role set to 'admin'`);
    } else {
      // Create minimal user document if it doesn't exist
      await userRef.set({
        uid: uid,
        role: 'admin',
        email: userRecord.email || '',
        name: userRecord.displayName || 'Admin User', 
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Created new user document with role 'admin'`);
    }
    
    console.log(`✅ Successfully made user ${uid} an admin!`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error making user admin:`, error);
    process.exit(1);
  }
}

makeUserAdmin(uid);
