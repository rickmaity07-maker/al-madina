import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Keep these in sync with ADMIN_COOKIE_NAME / CUSTOMER_COOKIE_NAME in lib/auth.ts / lib/customer-auth.ts
const ADMIN_COOKIE_NAME = "almadina_admin_session";
const CUSTOMER_COOKIE_NAME = "almadina_customer_session";
const SECRET_KEY = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
const encodedSecret = new TextEncoder().encode(SECRET_KEY);

const OWNER_ONLY_PREFIXES = ["/admin/products", "/admin/analytics"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const adminToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const customerToken = req.cookies.get(CUSTOMER_COOKIE_NAME)?.value;

    // .env fallback super-admin: its cookie carries the role directly, so
    // owner-only pages can be gated right here with no DB call.
    if (adminToken) {
      try {
        const { payload } = await jwtVerify(adminToken, encodedSecret);
        const isOwnerOnlyPage = OWNER_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
        if (isOwnerOnlyPage && payload.role !== "OWNER") {
          return NextResponse.redirect(new URL("/admin", req.url));
        }
        return NextResponse.next();
      } catch {
        // invalid/expired fallback cookie — fall through to the customer check
      }
    }

    // Shared login path: this only confirms a valid customer session exists.
    // Whether that customer is actually an admin (and which role) needs a
    // database lookup — that happens in getAdminSession(), used by every
    // admin API route and by AdminShell's own /api/admin/me check on
    // mount, which redirects to /admin/login if the answer is "no."
    if (customerToken) {
      try {
        await jwtVerify(customerToken, encodedSecret);
        return NextResponse.next();
      } catch {
        // invalid/expired — fall through to redirect
      }
    }

    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
