import { NextRequest, NextResponse } from 'next/server';
import { db, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { InventoryItem, InventoryItemData, Unit, SubCategory, Category } from '@/types/inventory';
import { AdditionRequestDoc, RequestedAdditionItem } from '@/types/admin';
import { convertUnits } from '@/lib/unitConversion';
import { AppTimestamp } from '@/types/timestamp';

// Helper to get the main category from a subcategory
const getMainCategory = (sub: SubCategory): Category => {
  if (["fruit","vegetables","juices","dairy"].includes(sub)) return Category.COOLER;
  if (["meats","cooked meats","frozen vegetables","bread","desserts","soups","dressings"].includes(sub)) return Category.FREEZER;
  if (sub === "dry")    return Category.DRY;
  if (sub === "canned") return Category.CANNED;
  return Category.OTHER;
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { requestId } = body;

  // 1. Authorization
  const token = request.headers.get("cookie")?.match(/session=([^;]+)/)?.[1];
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let adminUid;
  let adminName;
  try {
    const decodedToken = await adminAuth.verifySessionCookie(token, true);
    adminUid = decodedToken.uid;
    const adminUser = await adminAuth.getUser(adminUid);
    adminName = adminUser.displayName || adminUser.email || 'Admin';
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Pre-Transaction Conflict Check
  // This logic runs before the main transaction to check for non-convertible unit conflicts.
  try {
    const tempRequestRef = db.collection('additionRequests').doc(requestId);
    const tempRequestDoc = await tempRequestRef.get();
    if (!tempRequestDoc.exists) {
        return NextResponse.json({ error: "Addition request not found." }, { status: 404 });
    }
    const requestData = tempRequestDoc.data() as AdditionRequestDoc;
    // This logic handles both single and multiple item requests
    const itemsToCheck = requestData.requestedItems ?? (requestData.requestedItem ? [requestData.requestedItem] : []);

    const inventoryRef = db.collection('inventory');
    for (const item of itemsToCheck) {
      const normalizedName = item.name.trim().toLowerCase();
      const query = inventoryRef.where('normalizedName', '==', normalizedName);
      const snapshot = await query.get();

      if (!snapshot.empty) {
        const conflictingDoc = snapshot.docs.find(doc => {
          const existingUnit = doc.data().unit as Unit;
          // A conflict exists if the units are different AND they cannot be converted
          return existingUnit !== item.unit && convertUnits(1, item.unit as Unit, existingUnit) === null;
        });

        if (conflictingDoc) {
          // Return a 409 Conflict status with details for the client to handle
          return NextResponse.json({
            error: "Unit conversion conflict.",
            conflictDetails: {
              request: { id: requestId, ...requestData },
              item: item,
              existingUnit: conflictingDoc.data().unit,
              existingDocId: conflictingDoc.id,
            }
          }, { status: 409 });
        }
      }
    }
  } catch (error: any) {
    console.error("Error during pre-transaction conflict check:", error);
    return NextResponse.json({ error: "Failed during pre-flight check.", details: error.message }, { status: 500 });
  }

  // 3. Main Transaction
  const requestRef = db.collection('additionRequests').doc(requestId);
  try {
    const result = await db.runTransaction(async (transaction) => {
      const requestDoc = await transaction.get(requestRef);
      if (!requestDoc.exists) {
        throw new Error("Addition request not found.");
      }

      const requestData = requestDoc.data() as AdditionRequestDoc;
      if (requestData.status !== 'pending') {
        throw new Error(`Request has already been ${requestData.status}.`);
      }

      // Handle both single `requestedItem` and array `requestedItems` formats
      const items = requestData.requestedItems ?? (requestData.requestedItem ? [requestData.requestedItem] : []);
      if (items.length === 0) {
        throw new Error('No items found in request');
      }

      const processedItems = [];

      for (const item of items) {
        const { name, quantityToAdd, unit, subcategory } = item;
        const category = getMainCategory(subcategory as SubCategory);
        const normalizedName = name.trim().toLowerCase();
        const inventoryRef = db.collection('inventory');
        
        // Use a more flexible query to find items by name, then check units in code
        const query = inventoryRef.where('normalizedName', '==', normalizedName);
        const snapshot = await transaction.get(query);
        
        let existingDocRef: FirebaseFirestore.DocumentReference | null = null;
        let existingData: InventoryItem | null = null;

        if (!snapshot.empty) {
            const exactMatch = snapshot.docs.find(doc => doc.data().unit === unit as Unit);
            if (exactMatch) {
                existingDocRef = exactMatch.ref;
                existingData = exactMatch.data() as InventoryItem;
            } else {
                const convertibleMatch = snapshot.docs.find(doc => convertUnits(1, unit as Unit, doc.data().unit as Unit) !== null);
                if (convertibleMatch) {
                    existingDocRef = convertibleMatch.ref;
                    existingData = convertibleMatch.data() as InventoryItem;
                }
            }
        }
        
        let finalItemData;

        if (existingDocRef && existingData) {
          // Item exists, update it
          let quantityToAddConverted = quantityToAdd;

          if (existingData.unit !== unit) {
            const converted = convertUnits(quantityToAdd, unit as Unit, existingData.unit as Unit);
            if (converted === null) {
              // This should ideally be caught by the pre-transaction check, but is a safeguard
              throw new Error(`Cannot convert units from ${unit} to ${existingData.unit} for item ${name}.`);
            }
            quantityToAddConverted = converted;
          }

          const newQuantity = existingData.quantity + quantityToAddConverted;
          transaction.update(existingDocRef, {
            quantity: newQuantity,
            lastUpdated: FieldValue.serverTimestamp(),
          });
          finalItemData = { ...existingData, id: existingDocRef.id, quantity: newQuantity };
        } else {
          // Item does not exist, create it
          const newItemRef = inventoryRef.doc();
          const newItemData: InventoryItemData = {
            name: name.trim(),
            normalizedName,
            quantity: quantityToAdd,
            unit: unit as Unit,
            category,
            subcategory: subcategory as SubCategory,
            lastUpdated: FieldValue.serverTimestamp() as AppTimestamp,
          };
          transaction.set(newItemRef, newItemData);
          finalItemData = { ...newItemData, id: newItemRef.id };
        }
        processedItems.push(finalItemData);
      }

      // 4. Update the request status
      transaction.update(requestRef, {
        status: 'approved',
        adminId: adminUid,
        adminName: adminName,
        processedTimestamp: FieldValue.serverTimestamp(),
      });

      // 5. Create Action Log
      const actionLogRef = db.collection('actionLogs').doc();
      transaction.set(actionLogRef, {
        actionType: 'approve_addition_request',
        requestId: requestId,
        userId: requestData.userId,
        userName: requestData.userName,
        adminId: adminUid,
        adminName: adminName,
        timestamp: FieldValue.serverTimestamp(),
        details: {
          approvedItems: items,
          message: `Admin ${adminName} approved addition request ${requestId} from user ${requestData.userName}.`
        }
      });
      
      // 6. Create notification for the user
      const notificationRef = db.collection('notifications').doc();
      const message = items.length === 1 
        ? `Your addition request for ${items[0].quantityToAdd}x ${items[0].name} has been approved.`
        : `Your addition request for ${items.length} items has been approved.`;

      transaction.set(notificationRef, {
        userId: requestData.userId,
        type: 'request_approved',
        message: message,
        requestId: requestId,
        timestamp: FieldValue.serverTimestamp(),
        isRead: false,
      });

      return { items: processedItems };
    });

    return NextResponse.json({ message: "Request approved successfully.", items: result.items }, { status: 200 });

  } catch (error: any) {
    console.error("Error approving addition request:", error);
    // Ensure that if the transaction fails, a generic 500 error is returned
    return NextResponse.json({ error: error.message || "Failed to approve request." }, { status: 500 });
  }
}