import { NextResponse, NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getUserUid } from '@/lib/auth';

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const uid = await getUserUid(req);
  try {
    if (!uid) throw new Error('unauthenticated');
    const decoded = await adminAuth.getUser(uid);
    // Check for the 'admin' custom claim
    const customClaims = decoded.customClaims || {};
    const isAdmin = customClaims.admin === true;
    const userRole = isAdmin ? "admin" : "user";

    return NextResponse.json({
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.displayName || decoded.email,
      picture: decoded.photoURL,
      role: userRole,
    });
  } catch (error) { // Added error parameter to log it
    console.error("Error verifying session cookie in /api/auth/me:", error);
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}