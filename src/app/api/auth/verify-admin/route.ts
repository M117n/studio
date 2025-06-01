import { NextRequest } from 'next/server';
import { adminAuth, db } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    // Get session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return Response.json({ error: 'No session cookie provided' }, { status: 401 });
    }

    // Verify session
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
    const uid = decodedClaims.uid;

    // Get user document from Firestore to check role
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    
    // Check if user is admin
    if (userData?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin role required' }, { status: 403 });
    }

    // User is authenticated and has admin role
    return Response.json({ isAdmin: true });
    
  } catch (error) {
    console.error('Error verifying admin session:', error);
    return Response.json({ error: 'Authentication failed' }, { status: 401 });
  }
}
