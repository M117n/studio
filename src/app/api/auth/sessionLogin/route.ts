import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  const { idToken } = await req.json();
  const expiresIn = 2 * 60 * 60 * 1000; // 2 hours

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn,
    // Optionally: { ... }
  });

  const res = NextResponse.json({ status: "success" });
  res.cookies.set("session", sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: expiresIn / 1000,
    path: "/",
  });
  return res;
}