import * as admin from "firebase-admin";
import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();

export const setAdminRole = onCall(
    async (req: CallableRequest<{ uid: string }>) => {
      const { uid } = req.data;
  
      if (!req.auth) {
        throw new HttpsError("unauthenticated", "Must be signed in");
      }
  
      const caller = await admin.auth().getUser(req.auth.uid);
      if (caller.customClaims?.admin !== true) {
        throw new HttpsError("permission-denied", "Must be an admin");
      }
  
      await admin.auth().setCustomUserClaims(uid, { admin: true });
      return { message: `User ${uid} is now an admin.` };
    }
  );