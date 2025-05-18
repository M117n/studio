import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware will run on admin routes
export const config = {
  matcher: ['/admin/:path*'],
};

export function middleware(request: NextRequest) {
  // Get the session cookie
  const sessionCookie = request.cookies.get('session')?.value;

  if (!sessionCookie) {
    // No session cookie means not authenticated
    return NextResponse.redirect(new URL('/login?redirect=' + encodeURIComponent(request.nextUrl.pathname), request.url));
  }

  // Allow the request to proceed - we'll check the admin role in the page components
  // using AdminGuard which can do client-side authentication
  return NextResponse.next();
}
