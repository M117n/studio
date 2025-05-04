import { NextResponse, NextRequest } from "next/server";
        import { adminAuth } from "./src/lib/firebaseAdmin";

        const PUBLIC_PATHS = ["/auth/login", "/favicon.ico", "/robots.txt", "/public"];

        export async function middleware(req: NextRequest) {
          const { pathname } = req.nextUrl;

          // Allow public paths
          if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
            return NextResponse.next();
          }

          const session = req.cookies.get("session")?.value;
          if (!session) {
            const loginUrl = new URL("/auth/login", req.url);
            return NextResponse.redirect(loginUrl);
          }

          try {
            const decoded = await adminAuth.verifySessionCookie(session, true);
            req.headers.set("x-user-uid", decoded.uid);
            req.headers.set("x-user-role", (decoded as any).role || "user");
            return NextResponse.next();
          } catch {
            // expired or invalid → redirect to login
            const loginUrl = new URL("/auth/login", req.url);
            return NextResponse.redirect(loginUrl);
          }
        }

        export const config = {
          matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
        };