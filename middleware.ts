import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Ensure this matches the ADMIN_COOKIE_NAME exported in your lib/auth.ts
const COOKIE_NAME = "almadina_admin_session"; 
const SECRET_KEY = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
const encodedSecret = new TextEncoder().encode(SECRET_KEY);

const OWNER_ONLY_PREFIXES = ["/admin/products", "/admin/analytics"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    try {
      // Verify token using the Edge-compatible jose library
      const { payload } = await jwtVerify(token, encodedSecret);
      
      const isOwnerOnlyPage = OWNER_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
      if (isOwnerOnlyPage && payload.role !== "OWNER") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    } catch (err) {
      // Token is invalid, expired, or unreadable — bounce to login
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};