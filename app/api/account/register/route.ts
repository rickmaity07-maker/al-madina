// app/api/account/register/route.ts
import { NextRequest, NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signCustomerToken, CUSTOMER_COOKIE_NAME } from "@/lib/customer-auth";
import { mergeGuestCartIntoUser } from "@/lib/cart";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isDisposableEmail } from "@/lib/disposable-email";
import { isPlausiblePhoneNumber } from "@/lib/phone";
import { createEmailVerification } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/mailer";

const GUEST_CART_COOKIE_NAME = "almadina_guest_cart";

type UserRow = { id: string; email: string; full_name: string; phone: string | null };

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const { allowed } = rateLimit(`register:${ip}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again in a minute." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, email, password, phone } = body as {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { error: "Please use a permanent email address — temporary/disposable inboxes aren't accepted." },
      { status: 400 }
    );
  }
  if (phone && !isPlausiblePhoneNumber(phone)) {
    return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.$queryRaw<{ id: string }[]>`
    select id from users where email = ${normalizedEmail} limit 1
  `;
  if (existing[0]) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.$queryRaw<UserRow[]>`
    insert into users (email, password_hash, full_name, phone)
    values (${normalizedEmail}, ${passwordHash}, ${name.trim()}, ${phone?.trim() || null})
    returning id, email, full_name, phone
  `;
  const user = created[0];

  // Fold whatever they'd added to cart before registering into their new account cart.
  const guestToken = req.cookies.get(GUEST_CART_COOKIE_NAME)?.value;
  if (guestToken) {
    await mergeGuestCartIntoUser(guestToken, user.id).catch((e: unknown) =>
      console.error("[cart] guest merge failed on register", e)
    );
  }

  // Account works immediately (browse, cart, wishlist) — only checkout is
  // gated on this being confirmed. See app/api/orders/route.ts.
  const code = await createEmailVerification(user.id);
  after(async () => {
    await sendVerificationEmail(user.email, user.full_name, code).catch((e: unknown) =>
      console.error("[mailer] verification email failed", e)
    );
  });

  const token = signCustomerToken({ userId: user.id, email: user.email });
  const res = NextResponse.json({
    id: user.id,
    name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: null, // a brand-new account can't already be an admin
    emailVerified: false,
  });
  res.cookies.set(CUSTOMER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
  if (guestToken) res.cookies.delete(GUEST_CART_COOKIE_NAME);
  return res;
}
