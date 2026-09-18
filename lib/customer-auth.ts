import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { JWT_SECRET } from "./jwt-secret";
import { prisma } from "./prisma";

const COOKIE_NAME = "almadina_customer_session";
const SECRET = JWT_SECRET;

export type CustomerTokenPayload = {
  userId: string;
  email: string;
};

export function signCustomerToken(payload: CustomerTokenPayload) {
  return jwt.sign(payload, SECRET, { expiresIn: "60d" });
}

export function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as CustomerTokenPayload;
  } catch {
    return null;
  }
}

export const CUSTOMER_COOKIE_NAME = COOKIE_NAME;

/** Server-side helper: read + verify the customer session cookie in Route Handlers / Server Components. */
export async function getCustomerSession(): Promise<CustomerTokenPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyCustomerToken(token);
}

/**
 * Like getCustomerSession(), but also confirms the user row still exists.
 * A signed cookie can outlive its account (e.g. the database was reset/reseeded
 * after the cookie was issued) — verifyCustomerToken() only checks the
 * signature, so a stale cookie still "passes" as logged in. That's harmless
 * for reads (a SELECT ... where user_id = <gone> just returns nothing), but
 * fatal for any INSERT with a foreign key on users(id) — it throws a raw FK
 * violation instead of a clean "not logged in". Use this before those writes
 * (creating a cart, address, wishlist entry, review, or order for a session).
 */
export async function getVerifiedCustomerSession(): Promise<CustomerTokenPayload | null> {
  const session = await getCustomerSession();
  if (!session) return null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    select id from users where id = ${session.userId}::uuid and deleted_at is null limit 1
  `;
  return rows[0] ? session : null;
}
