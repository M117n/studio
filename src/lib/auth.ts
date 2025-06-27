import type { NextRequest } from 'next/server';
import { adminAuth } from './firebaseAdmin';

/**
 * Retrieves the authenticated user's UID from the request using the
 * Firebase session cookie. Returns `null` if the cookie is missing or
 * invalid.
 */
export async function getUserUid(req: NextRequest | Request): Promise<string | null> {
  const token = 'cookies' in req
    ? req.cookies.get('session')?.value
    : req.headers.get('cookie')?.match(/session=([^;]+)/)?.[1];

  if (!token) {
    return null;
  }

  try {
    const { uid } = await adminAuth.verifySessionCookie(token, true);
    return uid;
  } catch {
    return null;
  }
}
