import { NextRequest, NextResponse } from 'next/server';
import { db, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// This endpoint should only be accessible to super administrators
export async function POST(request: NextRequest) {
  try {
    // Get session cookie for authorization
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify session and user identity
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const requestingUserUid = decodedClaims.uid;
    
    // Security check: Verify that the requesting user is THE Master Admin
    const masterAdminEnvUid = process.env.MASTER_ADMIN_UID;
    if (!masterAdminEnvUid) {
        console.error("MASTER_ADMIN_UID environment variable is not set.");
        return NextResponse.json({ error: 'Server configuration error: Master Admin UID not set.' }, { status: 500 });
    }

    if (requestingUserUid !== masterAdminEnvUid) {
      return NextResponse.json({ error: 'Unauthorized: Only the Master Admin can grant admin privileges.' }, { status: 403 });
    }

    // Extract target user UID from request
    const { uid: targetUid } = await request.json();
    
    if (!targetUid || typeof targetUid !== 'string') {
      return NextResponse.json({ error: 'User ID (targetUid) is required and must be a string' }, { status: 400 });
    }
    
    // Ensure target user is not already the master admin
    if (targetUid === masterAdminEnvUid) {
        return NextResponse.json({ error: 'Cannot change the role of the Master Admin account.' }, { status: 400 });
    }

    // Verify the target user exists in Firebase Auth
    try {
      await adminAuth.getUser(targetUid);
    } catch (error) {
      console.error(`Target user ${targetUid} not found in Firebase Auth:`, error);
      return NextResponse.json({ error: 'Target user not found in authentication system.' }, { status: 404 });
    }
    
    // Get user document reference
    const userRef = db.collection('users').doc(targetUid);
    const userDoc = await userRef.get();
    
    // Consolidate data for setting/updating user document
    const userDataToSetOrUpdate = {
        role: 'admin',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: requestingUserUid 
    };

    if (userDoc.exists) {
      // Update existing user document
      await userRef.update(userDataToSetOrUpdate);
    } else {
      // Create new user document if it doesn't exist
      const targetUserAuthData = await adminAuth.getUser(targetUid); // Fetch auth data for email/name
      await userRef.set({
        uid: targetUid,
        email: targetUserAuthData.email || '',
        name: targetUserAuthData.displayName || targetUserAuthData.email?.split('@')[0] || 'Admin User', // Default name logic
        createdAt: FieldValue.serverTimestamp(),
        createdBy: requestingUserUid,
        ...userDataToSetOrUpdate // Spread the common fields
      });
    }

    // Set custom claim { admin: true }
    await adminAuth.setCustomUserClaims(targetUid, { admin: true });
    console.log(`Custom claim { admin: true } set for user ${targetUid}.`);

    // Add/Update user in 'adminUsers' collection
    const adminUserRef = db.collection('adminUsers').doc(targetUid);
    const targetUserAuthDataForAdminList = await adminAuth.getUser(targetUid); // Re-fetch or use previous userRecord
    const adminUserData = {
      uid: targetUid,
      email: targetUserAuthDataForAdminList.email || null,
      displayName: targetUserAuthDataForAdminList.displayName || null,
      adminSince: FieldValue.serverTimestamp()
    };
    await adminUserRef.set(adminUserData, { merge: true });
    console.log(`User ${targetUid} added/updated in 'adminUsers' collection.`);
    
    // Log this admin action
    await db.collection('actionLogs').add({
      actionType: 'set_admin_role',
      userId: targetUid,
      adminId: requestingUserUid,
      timestamp: FieldValue.serverTimestamp(),
      details: {
        message: `User ${targetUid} was granted admin role by Master Admin ${requestingUserUid}`
      }
    });
    
    return NextResponse.json({ success: true, message: `User ${targetUid} has been made an admin` });
  } catch (error: any) {
    console.error('Error making user admin:', error);
    // It's good practice to check for specific error types if possible
    if (error.code === 'auth/user-not-found') {
        return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update user role' }, { status: 500 });
  }
}
