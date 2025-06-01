import { NextResponse, NextRequest } from "next/server";
import { adminAuth, db } from "@/lib/firebaseAdmin";
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const masterAdminUid = process.env.MASTER_ADMIN_UID;

  if (!masterAdminUid) {
    console.error("MASTER_ADMIN_UID is not set in environment variables.");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  try {
    // 1. Verify session cookie and get caller's UID
    const sessionCookie = req.cookies.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized: No session cookie" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const callerUid = decodedToken.uid;

    // 2. Check if the caller is the Master Admin
    if (callerUid !== masterAdminUid) {
      return NextResponse.json({ error: "Forbidden: Only the Master Admin can revoke privileges." }, { status: 403 });
    }

    // 3. Get targetUid from request body
    const { uid: targetUid } = await req.json();
    if (!targetUid || typeof targetUid !== 'string') {
      return NextResponse.json({ error: "Bad Request: Missing or invalid target UID." }, { status: 400 });
    }

    // 4. Ensure Master Admin is not revoking their own privileges
    if (targetUid === masterAdminUid) {
      return NextResponse.json({ error: "Forbidden: Master Admin cannot revoke their own privileges." }, { status: 403 });
    }

    // 5. Revoke admin custom claim
    await adminAuth.setCustomUserClaims(targetUid, { admin: null }); // or { admin: false }

    // 6. Delete user from 'adminUsers' Firestore collection
    const adminUserDocRef = db.collection("adminUsers").doc(targetUid);
    await adminUserDocRef.delete();

    // 7. Update user's role in the 'users' collection
    const userRef = db.collection('users').doc(targetUid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      await userRef.update({
        role: 'regular', 
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: masterAdminUid 
      });
    } else {
      console.warn(`User document for UID ${targetUid} not found in 'users' collection during admin revocation.`);
    }
    
    // Log this admin action 
    await db.collection('actionLogs').add({
      actionType: 'revoke_admin_role',
      userId: targetUid,
      adminId: masterAdminUid,
      timestamp: FieldValue.serverTimestamp(),
      details: {
        message: `User ${targetUid} had their admin role revoked`
      }
    });

    console.log(`Admin privileges revoked for UID: ${targetUid} by Master Admin: ${callerUid}`);
    return NextResponse.json({ message: "Admin privileges revoked successfully." });

  } catch (error: any) {
    console.error("Error revoking admin privileges:", error);
    if (error.code === 'auth/session-cookie-expired' || error.code === 'auth/session-cookie-revoked') {
      return NextResponse.json({ error: "Unauthorized: Session expired or invalid." }, { status: 401 });
    }
    if (error.code === 'auth/user-not-found') {
        return NextResponse.json({ error: "User not found in Firebase Auth." }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error while revoking privileges." }, { status: 500 });
  }
}
