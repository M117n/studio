import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import type { InventoryItem, InventoryItemData } from "@/types/inventory";

/**
 * Payload that the client sends when creating an inventory item.
 * It is identical to `InventoryItemData` but may optionally include an
 * `id` field when the client needs to force-sync a locally generated id
 * (e.g. for optimistic-UI / offline support).  When the id is omitted the
 * server will auto-generate it as usual.
 */
type CreateItemPayload = Partial<InventoryItem> & InventoryItemData;

// GET /api/inventory - list all inventory items
export async function GET() {
  try {
    const snapshot = await db.collection("inventory").get();
    const items: InventoryItem[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as InventoryItemData),
    }));
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch inventory" },
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
    const data = (await request.json()) as CreateItemPayload;

    const { id, name, quantity, unit, category, subcategory } = data as CreateItemPayload;

    if (
      typeof name !== "string" ||
      typeof quantity !== "number" ||
      typeof unit !== "string" ||
      typeof category !== "string" ||
      typeof subcategory !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid inventory item data" },
        { status: 400 },
      );
    }

    // When the client supplies an id use it, otherwise let Firestore generate
    const docRef = id
      ? db.collection("inventory").doc(id)
      : db.collection("inventory").doc();

    const newItem: InventoryItemData = { name, quantity, unit, category, subcategory };

    await docRef.set(newItem);

    // Log the creation event in Firestore (best-effort)
    try {
      const logEntry = {
        action: "create",
        collection: "inventory",
        documentId: docRef.id,
        data: newItem,
        timestamp: Timestamp.now(),
      };
      await db.collection("logs").doc().set(logEntry);
    } catch (err: any) {
      console.error("Failed to log inventory creation:", err);
    }

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