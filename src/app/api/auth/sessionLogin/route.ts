// app/api/auth/sessionLogin/route.ts
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { idToken } = await req.json();              // lo manda el cliente
  if (!idToken) {
    return NextResponse.json({ error: "missing idToken" }, { status: 400 });
  }

  const expiresIn = 1000 * 60 * 60 * 24 * 5; // 5 días
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn,
  });

  const res = NextResponse.json({ ok: true });

  /* ——— set HTTP‑only cookie ——— */
  (await cookies()).set({
    name:   "session",
    value:  sessionCookie,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:  expiresIn / 1000, // en segundos
    path:   "/",
  });

  return res;
}
