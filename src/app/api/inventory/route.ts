import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import type { InventoryItem, InventoryItemData } from "@/types/inventory";
import { db, adminAuth } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { ChangeLogEntry } from "@/types/changeLog";

/**
 * Payload that the client sends when creating an inventory item.
 * It is identical to `InventoryItemData` but may optionally include an
 * `id` field when the client needs to force-sync a locally generated id
 * (e.g. for optimistic-UI / offline support).  When the id is omitted the
 * server will auto-generate it as usual.
 */
type CreateItemPayload = Partial<InventoryItem> & InventoryItemData;

// GET /api/inventory - list all inventory items
export async function GET(request: Request) { // Added request parameter
  try {
    const token = request.headers.get("cookie")?.match(/session=([^;]+)/)?.[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await adminAuth.verifySessionCookie(token, true);
    } catch (error) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await db.collection("inventory").get();
    const items: InventoryItem[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as InventoryItemData),
    }));
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch inventory",
        ...(error.code && { errorCode: error.code }),
        ...(error.message && { errorMessage: error.message }),
      },
      { status: 500 }
    );
  }
}

// POST /api/inventory - create a new inventory item
export async function POST(request: Request) {
  try {
    // Note: we accept an optional `id` because the front-end may generate one
    // for optimistic UI / offline scenarios.  Keeping that id avoids duplicates
    // when the page is reloaded before the server acknowledges the write.
    const token = request.headers.get("cookie")?.match(/session=([^;]+)/)?.[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let uid;
    try {
      ({ uid } = await adminAuth.verifySessionCookie(token, true));
    } catch (error) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const data = (await request.json()) as CreateItemPayload;

    const { id, name, quantity, unit, category, subcategory } = data as CreateItemPayload;

    // Enhanced validation
    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Invalid inventory item data", details: "Name must be a non-empty string." },
        { status: 400 },
      );
    }
    if (typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json(
        { error: "Invalid inventory item data", details: "Quantity must be a number greater than 0." },
        { status: 400 },
      );
    }
    if (typeof unit !== "string" || unit.trim() === "") {
      return NextResponse.json(
        { error: "Invalid inventory item data", details: "Unit must be a non-empty string." },
        { status: 400 },
      );
    }
    if (typeof category !== "string" || category.trim() === "") {
      return NextResponse.json(
        { error: "Invalid inventory item data", details: "Category must be a non-empty string." },
        { status: 400 },
      );
    }
    if (typeof subcategory !== "string" || subcategory.trim() === "") {
      return NextResponse.json(
        { error: "Invalid inventory item data", details: "Subcategory must be a non-empty string." },
        { status: 400 },
      );
    }

    // When the client supplies an id use it, otherwise let Firestore generate
    const docRef = id
      ? db.collection("inventory").doc(id)
      : db.collection("inventory").doc();

    const newItem: InventoryItemData = { 
      name, 
      normalizedName: name.trim().toLowerCase(), 
      quantity, 
      unit, 
      category, 
      subcategory 
    };

    await docRef.set(newItem);

    /* ---------- audit‑log (immutable) -------------------- */
    const logRef = db.collection("changeLogs")
                     .doc(uid)
                     .collection("events")
                     .doc();
    const log: ChangeLogEntry = {
      timestamp : FieldValue.serverTimestamp(),
      userId    : uid,
      action    : "CREATE",
      name,
      category,
      subcategory,
      quantity,
      unit,
    };
    await logRef.set(log);

    return NextResponse.json(
      { id: docRef.id, ...newItem } as InventoryItem,
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create inventory item" },
      { status: 500 },
    );
  }
}