// lib/auth.ts
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { getCustomerSession } from "./customer-auth";

const COOKIE_NAME = "almadina_admin_session";
const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

export type AdminRole = "OWNER" | "STAFF";

export type AdminTokenPayload = {
  username: string; // email for a real admin account, or the .env ADMIN_USERNAME for the fallback login
  role: AdminRole;
  adminId: string | null; // the customer users.id when authenticated via the shared login, null for the .env fallback
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

/**
 * Server-side helper: is the current visitor an admin? Checks two paths:
 *  1. The .env fallback super-admin, via its own cookie from /admin/login.
 *  2. The normal customer login — if this account has an admin_users row,
 *     they're an admin too, no separate credentials needed.
 */
export async function getAdminSession(): Promise<AdminTokenPayload | null> {
  const store = await cookies();
  const fallbackToken = store.get(COOKIE_NAME)?.value;
  if (fallbackToken) {
    const payload = verifyAdminToken(fallbackToken);
    if (payload) return payload;
  }

  const customerSession = await getCustomerSession();
  if (!customerSession?.userId) return null;

  const rows = await prisma.$queryRaw<{ role: AdminRole; email: string }[]>`
    select a.role, u.email
    from admin_users a
    join users u on u.id = a.user_id
    where a.user_id = ${customerSession.userId}::uuid
  `;
  if (!rows[0]) return null;

  return { username: rows[0].email, role: rows[0].role, adminId: customerSession.userId };
}

/** Verify a raw cookie header value (used in middleware, which uses NextRequest cookies directly). */
export function verifyTokenFromCookieValue(value: string | undefined) {
  if (!value) return null;
  return verifyAdminToken(value);
}
