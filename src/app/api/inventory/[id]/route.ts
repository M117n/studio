import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import type { InventoryItem, InventoryItemData } from "@/types/inventory";

/* ------------------------------------------------------------------ *
 * PUT /api/inventory/:id  →  Actualiza un ítem de inventario
 * ------------------------------------------------------------------ */

export async function PUT(
  req: NextRequest,
  { params }: any,
) {
  const { id } = params as { id: string };

  let body: InventoryItemData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const { name, quantity, unit, category, subcategory } = body;
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

  try {
    await db.collection("inventory").doc(id).update(body);
    return NextResponse.json({ id, ...body } as InventoryItem, { status: 200 });
  } catch (err: any) {
    console.error("PUT /api/inventory:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update inventory item" },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ *
 * DELETE /api/inventory/:id  →  Elimina un ítem de inventario
 * ------------------------------------------------------------------ */

export async function DELETE(
  _req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  // Properly await params if it's a promise
  const params = await Promise.resolve(context.params);
  const id = params.id;
  
  if (!id) {
    return NextResponse.json(
      { error: "Missing inventory item ID" },
      { status: 400 }
    );
  }

  try {
    await db.collection('inventory').doc(id).delete();
    
    // Return an empty response with status 200 for better client compatibility
    // This ensures the client knows the operation was successful
    return NextResponse.json(
      { success: true, id },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('DELETE /api/inventory:', err);
    return NextResponse.json(
      { error: err.message ?? 'Failed to delete inventory item' },
      { status: 500 },
    );
  }
}