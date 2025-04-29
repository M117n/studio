import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import type { InventoryItem, InventoryItemData } from "@/types/inventory";

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
    const data: InventoryItemData = await request.json();
    const { name, quantity, unit, category } = data;
    if (
      typeof name !== "string" ||
      typeof quantity !== "number" ||
      typeof unit !== "string" ||
      typeof category !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid inventory item data" },
        { status: 400 }
      );
    }
    const docRef = db.collection("inventory").doc();
    const newItem: InventoryItemData = { name, quantity, unit, category };
    await docRef.set(newItem);
    return NextResponse.json({ id: docRef.id, ...newItem } as InventoryItem, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create inventory item" },
      { status: 500 }
    );
  }
}