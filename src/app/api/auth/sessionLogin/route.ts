// app/api/auth/sessionLogin/route.ts
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

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

  // --- Add user to Firestore 'users' collection if not already present ---
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'New User', // Provide a default name
        role: 'regular', // Default role for new users
        createdAt: FieldValue.serverTimestamp(),
        // You can add other default fields here, e.g., photoURL: decodedToken.picture || null
      });
      console.log(`New user ${decodedToken.uid} added to 'users' collection.`);
    }
  } catch (error) {
    console.error("Error ensuring user exists in Firestore:", error);
    // Decide if this error should prevent login. For now, we'll log and continue.
    // If it's critical, you might return an error response here.
  }
  // --- End of Firestore user creation logic ---

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
