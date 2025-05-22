import { NextRequest, NextResponse } from 'next/server';
import { db, adminAuth } from '@/lib/firebaseAdmin'; // Assuming firebaseAdmin is correctly set up
import { FieldValue } from 'firebase-admin/firestore';
import { getMainCategory } from '@/types/inventory'; // Assuming this path is correct
import type { InventoryItemData } from '@/types/inventory';

// Define a type for the structure of an addition request document (mirroring Part 2's definition)
interface RequestedAddItemDetail {
  name: string;
  category: string; // Original category from form
  subcategory: string;
  quantityToAdd: number;
  unit: string;
}

interface AdditionRequestDoc {
  userId: string;
  userName: string;
  requestedItem: RequestedAddItemDetail;
  requestTimestamp: FirebaseFirestore.Timestamp; // Firestore Timestamp type
  status: 'pending' | 'approved' | 'rejected';
  // Optional fields for processed requests
  adminId?: string;
  adminName?: string;
  processedTimestamp?: FirebaseFirestore.Timestamp;
  adminNotes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const additionRequestId = params.id;
    const token = request.headers.get("cookie")?.match(/session=([^;]+)/)?.[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized: No session cookie" }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifySessionCookie(token, true);
    } catch (error) {
      return NextResponse.json({ error: "Unauthorized: Invalid session cookie" }, { status: 401 });
    }

    const { uid } = decodedToken;

    // Admin check: Fetch user's custom claims or a document indicating admin role
    // This is a simplified check; a more robust solution might involve checking a 'roles' collection
    // or specific custom claims set during user role management.
    const user = await adminAuth.getUser(uid);
    if (!user.customClaims?.isAdmin) {
      return NextResponse.json({ error: "Forbidden: User is not an admin" }, { status: 403 });
    }
    const adminDisplayName = user.displayName || uid; // Use displayName or UID as adminName

    const additionRequestRef = db.collection('additionRequests').doc(additionRequestId);

    // Use a transaction to ensure atomicity
    const newInventoryItemId = await db.runTransaction(async (transaction) => {
      const additionRequestSnap = await transaction.get(additionRequestRef);

      if (!additionRequestSnap.exists) {
        // Throw an error to be caught by the outer try/catch, transaction will auto-rollback
        throw new Error("Addition request not found."); 
      }

      const additionRequestData = additionRequestSnap.data() as AdditionRequestDoc;

      if (additionRequestData.status !== 'pending') {
        // Throw an error if already processed
        throw new Error(`Request already processed with status: ${additionRequestData.status}.`);
      }

      const { requestedItem } = additionRequestData;

      // Derive main category
      const mainCategory = getMainCategory(requestedItem.subcategory);
      if (!mainCategory) {
        // This case should ideally be prevented by validation when subcategory is chosen
        throw new Error(`Could not determine main category for subcategory: ${requestedItem.subcategory}`);
      }
      
      const newItemData: InventoryItemData = {
        name: requestedItem.name,
        quantity: requestedItem.quantityToAdd,
        unit: requestedItem.unit,
        subcategory: requestedItem.subcategory,
        category: mainCategory, // Derived main category
      };

      // Add to inventory - generate a new ID for the inventory item
      const newInventoryItemRef = db.collection('inventory').doc();
      transaction.set(newInventoryItemRef, newItemData);

      // Update the addition request
      transaction.update(additionRequestRef, {
        status: 'approved',
        adminId: uid,
        adminName: adminDisplayName, // Store admin's name
        processedTimestamp: FieldValue.serverTimestamp(),
      });
      
      return newInventoryItemRef.id; // Return the new item's ID from the transaction
    });
    
    return NextResponse.json(
      { message: 'Addition request approved successfully', itemId: newInventoryItemId },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("Error processing addition request approval:", error);
    // Differentiate errors based on message content from transaction
    if (error.message === "Addition request not found.") {
        return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.startsWith("Request already processed") || error.message.startsWith("Could not determine main category")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to approve addition request', details: error.message }, { status: 500 });
  }
}
