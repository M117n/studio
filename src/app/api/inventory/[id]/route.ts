import { NextRequest, NextResponse } from 'next/server';
import { db, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { InventoryItemData } from '@/types/inventory';
import type { ChangeLogEntry } from '@/types/changeLog';

/* -------------------- helpers ---------------------------------- */
function itemRef(id: string) {
  return db.collection('inventory').doc(id);
}
function logRef(uid: string) {
  return db.collection('changeLogs').doc(uid).collection('events').doc();
}

/* -------------------- GET /api/inventory/[id] ------------------ */
export async function GET(
  req: NextRequest, // Changed _req to req
  { params }: { params: { id: string } },
) {
  try {
    const token = req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await adminAuth.verifySessionCookie(token, true);
    } catch (error) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract the ID parameter to avoid using params.id directly
    const itemId = params.id;

    const snap = await itemRef(itemId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ id: snap.id, ...(snap.data() as InventoryItemData) });
  } catch (error: any) {
    // Generic error handling, can be improved as well if needed
    return NextResponse.json(
      {
        error: "Failed to fetch item",
        ...(error.code && { errorCode: error.code }),
        ...(error.message && { errorMessage: error.message }),
      },
      { status: 500 }
    );
  }
}

/* -------------------- PATCH /api/inventory/[id] ---------------- */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = req.headers.get('cookie')?.match(/session=([^;]+)/)?.[1] ?? '';
  const { uid } = await adminAuth.verifySessionCookie(token, true);

  // Extract the ID parameter to avoid using params.id directly
  const itemId = params.id;

  const patch = await req.json();

  // Validate patch data
  if (typeof patch !== 'object' || patch === null) {
    return NextResponse.json({ error: "Invalid patch data", details: "Patch data must be an object." }, { status: 400 });
  }

  if (Object.keys(patch).length === 0) {
    // Or handle as a no-op success, but for now let's ensure something is being patched if called.
    // Alternatively, could return NextResponse.json({ message: "No fields to update" }, { status: 200 });
    return NextResponse.json({ error: "Invalid patch data", details: "Patch data cannot be empty." }, { status: 400 });
  }

  for (const key in patch) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const value = patch[key];
      switch (key) {
        case 'name':
          if (typeof value !== 'string' || value.trim() === '') {
            return NextResponse.json({ error: "Invalid patch data", details: "Name must be a non-empty string." }, { status: 400 });
          }
          break;
        case 'quantity':
          if (typeof value !== 'number' || value <= 0) {
            return NextResponse.json({ error: "Invalid patch data", details: "Quantity must be a number greater than 0." }, { status: 400 });
          }
          break;
        case 'unit':
        case 'category':
        case 'subcategory':
          if (typeof value !== 'string' || value.trim() === '') {
            return NextResponse.json({ error: "Invalid patch data", details: `${key.charAt(0).toUpperCase() + key.slice(1)} must be a non-empty string.` }, { status: 400 });
          }
          break;
        // Add cases for other valid fields if necessary, and a default to handle unknown fields
        default:
          // Optional: reject patches with unknown fields
          // return NextResponse.json({ error: "Invalid patch data", details: `Unknown field: ${key}` }, { status: 400 });
          break;
      }
    }
  }

  // Fetch current item state for accurate logging
  const itemSnap = await itemRef(itemId).get();
  if (!itemSnap.exists) {
    return NextResponse.json({ error: "Item not found to update" }, { status: 404 });
  }
  const currentItemData = itemSnap.data() as InventoryItemData;

  const batch = db.batch();
  batch.update(itemRef(itemId), patch);

  const log: ChangeLogEntry = {
    timestamp : FieldValue.serverTimestamp(),
    userId    : uid,
    action    : 'UPDATE',
    name      : patch.name !== undefined ? patch.name : currentItemData.name,
    category  : patch.category !== undefined ? patch.category : (currentItemData.category || 'other'),
    subcategory: patch.subcategory !== undefined ? patch.subcategory : (currentItemData.subcategory || 'other'),
    quantity  : patch.quantity !== undefined ? patch.quantity : currentItemData.quantity,
    unit      : patch.unit !== undefined ? patch.unit : currentItemData.unit,
  };
  batch.set(logRef(uid), log);

  await batch.commit();
  // Return the updated item
  const updatedItem = { id: itemId, ...currentItemData, ...patch };
  return NextResponse.json(updatedItem); // Status 200 is default for NextResponse.json
}

/* ------------------ DELETE /api/inventory/[id] ----------------- */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = req.headers.get('cookie')?.match(/session=([^;]+)/)?.[1] ?? '';
  const { uid } = await adminAuth.verifySessionCookie(token, true);
  
  // Extract the ID parameter to avoid using params.id directly
  const itemId = params.id;

  const snap = await itemRef(itemId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const data = snap.data() as InventoryItemData;

  const batch = db.batch();
  batch.delete(itemRef(itemId));

  const log: ChangeLogEntry = {
    timestamp : FieldValue.serverTimestamp(),
    userId    : uid,
    action    : 'DELETE',
    name      : data.name,
    category  : data.category || 'other', // Provide default if undefined
    subcategory: data.subcategory || 'other', // Provide default if undefined
    quantity  : data.quantity,
    unit      : data.unit,
  };
  batch.set(logRef(uid), log);

  await batch.commit();
  return NextResponse.json({ ok: true });
}
