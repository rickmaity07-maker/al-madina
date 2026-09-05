import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "almadina_admin_session";
const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

// Runs on the Edge runtime, so we verify the JWT directly here rather than
// importing lib/auth.ts (which uses next/headers, server-component only).
function isValidSession(token: string | undefined) {
  if (!token) return false;
  try {
    jwt.verify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!isValidSession(token)) {
      const loginUrl = new URL("/admin/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
