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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }, // <- Promise añadida
) {
  try {
    const { id } = await params; // <- await añadido
    
    const token = req.cookies.get('session')?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await adminAuth.verifySessionCookie(token, true);
    } catch (error) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snap = await itemRef(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ id: snap.id, ...(snap.data() as InventoryItemData) });
  } catch (error: any) {
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
  { params }: { params: Promise<{ id: string }> }, // <- Promise añadida
) {
  try {
    const { id } = await params; // <- await añadido
    
    const token = req.cookies.get('session')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let uid: string;
    try {
      ({ uid } = await adminAuth.verifySessionCookie(token, true));
    } catch (err) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const patch = await req.json();

    // Validate patch data
    if (typeof patch !== 'object' || patch === null) {
      return NextResponse.json({ error: "Invalid patch data", details: "Patch data must be an object." }, { status: 400 });
    }

    if (Object.keys(patch).length === 0) {
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
          default:
            break;
        }
      }
    }

    // Fetch current item state for accurate logging
    const itemSnap = await itemRef(id).get();
    if (!itemSnap.exists) {
      return NextResponse.json({ error: "Item not found to update" }, { status: 404 });
    }
    const currentItemData = itemSnap.data() as InventoryItemData;

    const batch = db.batch();
    batch.update(itemRef(id), patch);

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
    const updatedItem = { id, ...currentItemData, ...patch };
    return NextResponse.json(updatedItem);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to update item",
        ...(error.code && { errorCode: error.code }),
        ...(error.message && { errorMessage: error.message }),
      },
      { status: 500 }
    );
  }
}

/* ------------------ DELETE /api/inventory/[id] ----------------- */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }, // <- Promise añadida
) {
  try {
    const { id } = await params; // <- await añadido
    console.log('DELETE request started for item:', id);
    
    const token = req.cookies.get('session')?.value;
    if (!token) {
      console.log('No token found in cookies');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let uid: string;
    try {
      ({ uid } = await adminAuth.verifySessionCookie(token, true));
      console.log('Token verified, uid:', uid);
    } catch (err) {
      console.error('Token verification failed:', err);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  
    console.log('Attempting to delete item:', id);

    const snap = await itemRef(id).get();
    if (!snap.exists) {
      console.log('Item not found:', id);
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const data = snap.data() as InventoryItemData;
    console.log('Item found, data:', data);

    const batch = db.batch();
    batch.delete(itemRef(id));

    const log: ChangeLogEntry = {
      timestamp : FieldValue.serverTimestamp(),
      userId    : uid,
      action    : 'DELETE',
      name      : data.name,
      category  : data.category || 'other',
      subcategory: data.subcategory || 'other',
      quantity  : data.quantity,
      unit      : data.unit,
    };
    batch.set(logRef(uid), log);
    console.log('About to commit batch delete');

    await batch.commit();
    console.log('Delete batch committed successfully');
    
    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error: any) {
    console.error('DELETE operation failed:', error);
    return NextResponse.json(
      {
        error: "Failed to delete item",
        ...(error.code && { errorCode: error.code }),
        ...(error.message && { errorMessage: error.message }),
      },
      { status: 500 }
    );
  }
}