// app/api/auth/sessionLogout/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST() {
  const session = (await cookies()).get("session")?.value;
  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session);
      // Invalida la cookie del lado servidor si quieres (opcional):
      await adminAuth.revokeRefreshTokens(decoded.sub);
    } catch {/* ignore */}
  }

  (await cookies()).set({
    name: "session",
    value: "",
    maxAge: 0,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
