// app/api/account/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signCustomerToken, CUSTOMER_COOKIE_NAME } from "@/lib/customer-auth";
import { mergeGuestCartIntoUser } from "@/lib/cart";

const GUEST_CART_COOKIE_NAME = "almadina_guest_cart";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  role: "OWNER" | "STAFF" | null;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const rows = await prisma.$queryRaw<UserRow[]>`
    select u.id, u.email, u.password_hash, u.full_name, u.phone, a.role
    from users u
    left join admin_users a on a.user_id = u.id
    where u.email = ${normalizedEmail} and u.deleted_at is null
    limit 1
  `;
  const user = rows[0];

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Fold whatever they'd added to cart before logging in into their account cart.
  const guestToken = req.cookies.get(GUEST_CART_COOKIE_NAME)?.value;
  if (guestToken) {
    await mergeGuestCartIntoUser(guestToken, user.id).catch((e: unknown) =>
      console.error("[cart] guest merge failed on login", e)
    );
  }

  const token = signCustomerToken({ userId: user.id, email: user.email });
  const res = NextResponse.json({
    id: user.id,
    name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  });
  res.cookies.set(CUSTOMER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  if (guestToken) res.cookies.delete(GUEST_CART_COOKIE_NAME);
  return res;
}
