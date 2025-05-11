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
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const snap = await itemRef(params.id).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ id: snap.id, ...(snap.data() as InventoryItemData) });
}

/* -------------------- PATCH /api/inventory/[id] ---------------- */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = req.headers.get('cookie')?.match(/session=([^;]+)/)?.[1] ?? '';
  const { uid } = await adminAuth.verifySessionCookie(token, true);

  const patch = await req.json();                // validate in real life
  const batch = db.batch();

  batch.update(itemRef(params.id), patch);

  const log: ChangeLogEntry = {
    timestamp : FieldValue.serverTimestamp(),
    userId    : uid,
    action    : 'UPDATE',
    name      : patch.name,
    category  : patch.category,
    subcategory: patch.subcategory,
    quantity  : patch.quantity,
    unit      : patch.unit,
  };
  batch.set(logRef(uid), log);

  await batch.commit();
  return NextResponse.json({ ok: true });
}

/* ------------------ DELETE /api/inventory/[id] ----------------- */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = req.headers.get('cookie')?.match(/session=([^;]+)/)?.[1] ?? '';
  const { uid } = await adminAuth.verifySessionCookie(token, true);

  const snap = await itemRef(params.id).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const data = snap.data() as InventoryItemData;

  const batch = db.batch();
  batch.delete(itemRef(params.id));

  const log: ChangeLogEntry = {
    timestamp : FieldValue.serverTimestamp(),
    userId    : uid,
    action    : 'DELETE',
    name      : data.name,
    category  : data.category,
    subcategory: data.subcategory,
    quantity  : data.quantity,
    unit      : data.unit,
  };
  batch.set(logRef(uid), log);

  await batch.commit();
  return NextResponse.json({ ok: true });
}
