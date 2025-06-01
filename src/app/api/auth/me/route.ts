import { NextResponse, NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("session")?.value ?? "";
  try {
    const decoded = await adminAuth.verifySessionCookie(token, true);
    // Check for the 'admin' custom claim
    const isAdmin = decoded.admin === true;
    const userRole = isAdmin ? "admin" : "user";

    return NextResponse.json({
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email, // Fallback for name
      picture: decoded.picture, // Handle if picture can be undefined
      role: userRole,
    });
  } catch (error) { // Added error parameter to log it
    console.error("Error verifying session cookie in /api/auth/me:", error);
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}