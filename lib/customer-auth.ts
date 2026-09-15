import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "almadina_customer_session";
const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

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
