// src/app/api/inventory/[id]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import type { InventoryItem, InventoryItemData } from "@/types/inventory";

// Shape del contexto que Next pasa como 2º argumento
type Ctx = { params: { id: string } };

/* ------------------------------------------------------------------ *
 * PUT /api/inventory/:id  →  Actualiza un ítem de inventario
 * ------------------------------------------------------------------ */
export async function PUT(req: NextRequest, { params }: Ctx) {
  // params may be a Promise in Next.js dynamic routes; await before accessing
  const { id } = await params;

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
export async function DELETE(_: NextRequest, { params }: Ctx) {
  // params may be a Promise in Next.js dynamic routes; await before accessing
  const { id } = await params;

  try {
    await db.collection("inventory").doc(id).delete();
    // Return no content for successful deletion
    return NextResponse.json(null, { status: 204 });
  } catch (err: any) {
    console.error("DELETE /api/inventory:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete inventory item" },
      { status: 500 },
    );
  }
}