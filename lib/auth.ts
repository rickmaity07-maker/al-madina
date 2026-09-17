import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "almadina_admin_session";
const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

export type AdminRole = "OWNER" | "STAFF";

export type AdminTokenPayload = {
  username: string; // email for a real AdminUser account, or the .env ADMIN_USERNAME for the fallback login
  role: AdminRole;
  adminId: string | null; // null when logged in via the .env fallback account
};

export function signAdminToken(payload: AdminTokenPayload) {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as AdminTokenPayload;
  } catch {
    return null;
  }
}

/** OWNER-only areas (analytics, product editing, review moderation, team management). */
export function isOwner(session: AdminTokenPayload | null): boolean {
  return session?.role === "OWNER";
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;

/** Server-side helper: read + verify the admin session cookie in Route Handlers / Server Components. */
export async function getAdminSession(): Promise<AdminTokenPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

/** Verify a raw cookie header value (used in middleware, which uses NextRequest cookies directly). */
export function verifyTokenFromCookieValue(value: string | undefined) {
  if (!value) return null;
  return verifyAdminToken(value);
}
