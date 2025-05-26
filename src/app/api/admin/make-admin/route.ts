import { NextRequest } from 'next/server';
import { db, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// This endpoint should only be accessible to super administrators
export async function POST(request: NextRequest) {
  try {
    // Get session cookie for authorization
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify session and user identity
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
    const requestingUserUid = decodedClaims.uid;
    
    // Security check: Verify that the requesting user is a super admin
    // You may want to implement a more robust authorization system
    const requestingUserDoc = await db.collection('users').doc(requestingUserUid).get();
    
    if (!requestingUserDoc.exists || requestingUserDoc.data()?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin privileges required' }, { status: 403 });
    }

    // Extract target user UID from request
    const { uid } = await request.json();
    
    if (!uid) {
      return Response.json({ error: 'User ID (uid) is required' }, { status: 400 });
    }
    
    // Verify the target user exists in Firebase Auth
    try {
      await adminAuth.getUser(uid);
    } catch (error) {
      return Response.json({ error: 'User not found in authentication system' }, { status: 404 });
    }
    
    // Get user document reference
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      // Update existing user document
      await userRef.update({ 
        role: 'admin',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: requestingUserUid 
      });
    } else {
      // Create new user document if it doesn't exist
      const targetUser = await adminAuth.getUser(uid);
      await userRef.set({
        uid: uid,
        role: 'admin',
        email: targetUser.email || '',
        name: targetUser.displayName || 'Admin User',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: requestingUserUid
      });
    }

    // Set custom claim { admin: true }
    await adminAuth.setCustomUserClaims(uid, { admin: true });
    console.log(`Custom claim { admin: true } set for user ${uid}.`); // Optional: for logging

    // Add/Update user in 'adminUsers' collection
    const userRecord = await adminAuth.getUser(uid); // Use the correct UID variable
    const adminUserRef = db.collection('adminUsers').doc(uid); // Use the correct UID variable
    const adminUserData = {
      uid: uid, // Use the correct UID variable
      email: userRecord.email || null,
      displayName: userRecord.displayName || null,
      adminSince: FieldValue.serverTimestamp() // Make sure FieldValue is imported from 'firebase-admin/firestore'
    };
    await adminUserRef.set(adminUserData, { merge: true });
    console.log(`User ${uid} added/updated in 'adminUsers' collection.`); // Optional: for logging
    
    // Log this admin action
    await db.collection('actionLogs').add({
      actionType: 'set_admin_role',
      userId: uid,
      adminId: requestingUserUid,
      timestamp: FieldValue.serverTimestamp(),
      details: {
        message: `User ${uid} was granted admin role`
      }
    });
    
    return Response.json({ success: true, message: `User ${uid} has been made an admin` });
  } catch (error: any) {
    console.error('Error making user admin:', error);
    return Response.json({ error: error.message || 'Failed to update user role' }, { status: 500 });
  }
}
