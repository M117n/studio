import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
// Ensure this is done only once, typically at the global scope of your functions file.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Define MASTER_ADMIN_UID from environment variables
// You'll need to set this in your Firebase function's environment configuration:
// firebase functions:config:set master.admin_uid="YOUR_MASTER_ADMIN_UID_HERE"
// Remember to deploy the config: firebase deploy --only functions
const MASTER_ADMIN_UID = functions.config().master?.admin_uid;

if (!MASTER_ADMIN_UID) {
  console.error("FATAL ERROR: MASTER_ADMIN_UID environment variable is not set. Revoke admin functionality will not work.");
}

interface RevokeAdminData {
  uidToRevoke: string;
}

export const revokeAdmin = functions.https.onCall(async (request: functions.https.CallableRequest<RevokeAdminData>, _response?: any) => {
  // 1. Check if caller is authenticated
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // 2. Check if MASTER_ADMIN_UID is configured
  if (!MASTER_ADMIN_UID) {
    console.error("Master Admin UID is not configured in function environment.");
    throw new functions.https.HttpsError(
      "internal",
      "Server configuration error. Please contact support."
    );
  }

  // 3. Check if the caller is the Master Admin
  const callerUid = request.auth.uid;
  if (callerUid !== MASTER_ADMIN_UID) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only the Master Admin can revoke admin privileges."
    );
  }

  // 4. Get the UID to revoke from the request data
  const { uidToRevoke } = request.data;

  // 5. Prevent Master Admin from revoking their own privileges
  if (uidToRevoke === MASTER_ADMIN_UID) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The Master Admin cannot revoke their own privileges."
    );
  }

  try {
    // 6. Revoke custom claim
    await admin.auth().setCustomUserClaims(uidToRevoke, { admin: false });

    // 7. Remove user from 'adminUsers' collection in Firestore
    const adminUserDocRef = db.collection("adminUsers").doc(uidToRevoke);
    await adminUserDocRef.delete();

    console.log(`Successfully revoked admin privileges for UID: ${uidToRevoke} by Master Admin: ${callerUid}`);
    return { success: true, message: "Admin privileges revoked successfully." };
  } catch (error) {
    console.error("Error revoking admin privileges:", error);
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    throw new functions.https.HttpsError(
      "internal",
      `Failed to revoke admin privileges: ${errorMessage}`
    );
  }
});

// You might have other functions here...
