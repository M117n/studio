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
    
    // Target UID specified in the request
    const targetUid = '9CuI7xQ8FPOscSoArVX3aC3SPoZ2';

    // Verify the target user exists in Firebase Auth
    try {
      await adminAuth.getUser(targetUid);
    } catch (error) {
      return Response.json({ error: 'User not found in authentication system' }, { status: 404 });
    }
    
    // Get user document reference
    const userRef = db.collection('users').doc(targetUid);
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
      const targetUser = await adminAuth.getUser(targetUid);
      await userRef.set({
        uid: targetUid,
        role: 'admin',
        email: targetUser.email || '',
        name: targetUser.displayName || 'Admin User',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: requestingUserUid
      });
    }
    
    // Log this admin action
    await db.collection('actionLogs').add({
      actionType: 'set_admin_role',
      userId: targetUid,
      adminId: requestingUserUid,
      timestamp: FieldValue.serverTimestamp(),
      details: {
        message: `User ${targetUid} was granted admin role`
      }
    });
    
    return Response.json({ success: true, message: `User ${targetUid} has been made an admin` });
  } catch (error: any) {
    console.error('Error making user admin:', error);
    return Response.json({ error: error.message || 'Failed to update user role' }, { status: 500 });
  }
}
