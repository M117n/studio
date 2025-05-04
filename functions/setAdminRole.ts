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
      if (caller.customClaims?.role !== "admin") {
        throw new HttpsError("permission-denied", "Must be an admin");
      }
  
      await admin.auth().setCustomUserClaims(uid, { role: "admin" });
      return { message: `User ${uid} is now an admin.` };
    }
  );