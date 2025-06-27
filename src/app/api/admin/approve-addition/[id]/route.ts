import { NextRequest, NextResponse } from 'next/server';
import { db, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { InventoryItem, InventoryItemData, Unit, SubCategory, Category, isValidCategory, isValidSubCategory, isValidUnit } from '@/types/inventory';
import { AdditionRequestDoc } from '@/types/admin';
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

  const requestRef = db.collection('additionRequests').doc(requestId);
  console.log("✅ POST handler called with requestId:", requestId);
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

      const { requestedItem } = requestData;
      const { name, quantityToAdd, unit, subcategory } = requestedItem;
      const category = getMainCategory(subcategory as SubCategory);
      const normalizedName = name.trim().toLowerCase();

      const inventoryRef = db.collection('inventory');
      console.log("Searching for:", normalizedName, unit);
      const query = inventoryRef
      .where('normalizedName', '==', normalizedName)
      .where('unit', '==', unit)
      .limit(1);    
      const snapshot = await transaction.get(query);

      let itemId: string;
      let finalItemData: InventoryItem;

      if (!snapshot.empty) {
        // Item exists, update it
        const existingDoc = snapshot.docs[0];
        itemId = existingDoc.id;
        const existingData = existingDoc.data() as InventoryItem;
        let quantityToAddConverted = quantityToAdd;

        if (existingData.unit !== unit) {
          const converted = convertUnits(quantityToAdd, unit as Unit, existingData.unit);
          if (converted === null) {
            throw new Error(`Cannot convert units from ${unit} to ${existingData.unit} for item ${name}.`);
          }
          quantityToAddConverted = converted;
        }

        const newQuantity = existingData.quantity + quantityToAddConverted;
        transaction.update(existingDoc.ref, {
          quantity: newQuantity,
          lastUpdated: FieldValue.serverTimestamp(),
        });
        finalItemData = { ...existingData, id: itemId, quantity: newQuantity };
      } else {
        // Item does not exist, create it
        const newItemRef = inventoryRef.doc();
        itemId = newItemRef.id;
        const newItemData: InventoryItemData = {
          name: name.trim(),
          normalizedName,
          quantity: quantityToAdd,
          unit: unit as Unit,
          category,
          subcategory: subcategory as SubCategory,
          lastUpdated: FieldValue.serverTimestamp() as AppTimestamp,
        };
        console.log("🧾 newItemData:", JSON.stringify(newItemData, null, 2));
        transaction.set(newItemRef, newItemData);
        finalItemData = { ...newItemData, id: itemId };
      }

      // Update the request status
      transaction.update(requestRef, {
        status: 'approved',
        adminId: adminUid,
        adminName: adminName,
        processedTimestamp: FieldValue.serverTimestamp(),
      });

      // Create notification for the user
      const notificationRef = db.collection('notifications').doc();
      transaction.set(notificationRef, {
        userId: requestData.userId,
        type: 'request_approved',
        message: `Your addition request for ${quantityToAdd}x ${name} has been approved.`,
        requestId: requestId,
        timestamp: FieldValue.serverTimestamp(),
        isRead: false,
      });

      return { itemId, item: finalItemData };
    });

    return NextResponse.json({ message: "Request approved successfully.", itemId: result.itemId, item: result.item }, { status: 200 });

  } catch (error: any) {
    console.error("Error approving addition request:", error);
    return NextResponse.json({ error: error.message || "Failed to approve request." }, { status: 500 });
  }
}