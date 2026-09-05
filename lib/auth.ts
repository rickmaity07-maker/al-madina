import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "almadina_admin_session";
const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

export type AdminTokenPayload = {
  username: string;
  role: "admin" | "delivery";
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
