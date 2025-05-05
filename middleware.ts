import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Use the alias path to avoid brittle relative imports.
import { adminAuth } from "@/lib/firebaseAdmin";

/**
 * Paths that can be accessed without being authenticated. Keep this list
 * intentionally small – anything added here bypasses auth completely.
 */
const PUBLIC_PATHS = new Set<string>([
  "/auth/login",
  "/auth/register",
  "/favicon.ico",
  "/robots.txt",
]);

/**
 * Helper that returns a redirect (for pages) or a 401 JSON response (for API
 * routes) when the user is not authenticated.
 */
function unauthenticatedResponse(req: NextRequest) {
  // If the request targets an API route, respond with 401 instead of a redirect
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Otherwise redirect to the login page and carry the original destination in
  // the "next" query parameter so the user can be sent back after login.
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/auth/login";
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* ---------------------------------------------------------------------- */
  /* 1. Skip internal Next.js asset requests                                */
  /* ---------------------------------------------------------------------- */
  // Middleware runs for *every* request that matches the `matcher` below. We
  // explicitly ignore Next.js internals and static assets up-front because we
  // never want to gate them behind authentication.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname.match(/\.(?:png|jpg|jpeg|gif|svg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  /* ---------------------------------------------------------------------- */
  /* 2. Allow public paths                                                  */
  /* ---------------------------------------------------------------------- */
  if (PUBLIC_PATHS.has(pathname) || [...PUBLIC_PATHS].some((p) => pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  /* ---------------------------------------------------------------------- */
  /* 3. Require a valid session cookie                                      */
  /* ---------------------------------------------------------------------- */
  const sessionCookie = req.cookies.get("session")?.value;
  if (!sessionCookie) {
    return unauthenticatedResponse(req);
  }

  /* ---------------------------------------------------------------------- */
  /* 4. Verify the Firebase session cookie                                  */
  /* ---------------------------------------------------------------------- */
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    // Forward useful auth information to the downstream request so that API
    // routes and pages can access it via `request.headers.get(...)`.
    const res = NextResponse.next();
    res.headers.set("x-user-uid", decoded.uid);
    res.headers.set("x-user-role", (decoded as { role?: string }).role ?? "user");
    return res;
  } catch {
    // Invalid/expired session – clear the cookie and respond accordingly.
    const res = unauthenticatedResponse(req);
    res.cookies.set("session", "", { maxAge: 0, path: "/" });
    return res;
  }
}

// Apply middleware to *all* routes. We manually skip static assets above so
// that we don’t accidentally expose new asset paths in the future.
export const config = {
  matcher: ["/(.*)"] as const,
};