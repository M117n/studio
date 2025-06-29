import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { getUserUid } from '@/lib/auth';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Get session cookie and verify authentication
    const uid = await getUserUid(req);
    if (!uid) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 3. Parse the request body
    const body = await req.json();
    const { userId, userName, requestedItem, requestedItems } = body;

    // 4. Validate that the authenticated user is the same as the request user
    if (uid !== userId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }

    // 5. Create the addition request in Firestore
    const additionRequestData = {
      userId,
      userName,
      requestTimestamp: FieldValue.serverTimestamp(),
      status: 'pending',
      ...(requestedItems
        ? { requestedItems }
        : { requestedItem }),
    };

    // 6. Add the document to the additionRequests collection
    const docRef = await db.collection('additionRequests').add(additionRequestData);

    // 7. Return success response
    return NextResponse.json({ 
      success: true, 
      message: 'Addition request created successfully',
      requestId: docRef.id
    });
  } catch (error: any) {
    console.error('Error creating addition request:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create addition request' 
    }, { 
      status: 500 
    });
  }
}
