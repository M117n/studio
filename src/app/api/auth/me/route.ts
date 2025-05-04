import { NextResponse, NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("session")?.value ?? "";
  try {
    const decoded = await adminAuth.verifySessionCookie(token, true);
    return NextResponse.json({
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      role: (decoded as { role?: string }).role ?? "user",
    });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}