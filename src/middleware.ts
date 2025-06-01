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
    // Redirect to the home page, which should handle login via AuthPanel.
    // Keep the original path as a 'redirect' query param for post-login navigation.
    const loginUrl = new URL('/', request.url); // Base URL is now home page
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname); // Set the intended redirect path

    // Preserve any other search parameters from the original request
    const originalSearchParams = new URLSearchParams(request.nextUrl.search);
    originalSearchParams.forEach((value, key) => {
      if (key !== 'redirect') { // Avoid overwriting our primary redirect param
        loginUrl.searchParams.append(key, value); // Use append to handle multi-value params correctly
      }
    });

    return NextResponse.redirect(loginUrl);
  }

  // Allow the request to proceed - we'll check the admin role in the page components
  // using AdminGuard which can do client-side authentication
  return NextResponse.next();
}
