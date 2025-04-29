import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

interface Params {
  params: {
    id: string;
  };
}

// PUT /api/inventory/:id - update an existing inventory item
export async function PUT(request: Request, { params }: Params) {
  const { id } = params;
  try {
    const data = await request.json();
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
    const docRef = db.collection("inventory").doc(id);
    await docRef.update({ name, quantity, unit, category });
    return NextResponse.json({ id, name, quantity, unit, category });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update inventory item" },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/:id - remove an inventory item
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = params;
  try {
    const docRef = db.collection("inventory").doc(id);
    await docRef.delete();
    return NextResponse.json({ id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete inventory item" },
      { status: 500 }
    );
  }
}