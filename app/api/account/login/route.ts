// app/api/account/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signCustomerToken, CUSTOMER_COOKIE_NAME } from "@/lib/customer-auth";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const rows = await prisma.$queryRaw<UserRow[]>`
    select id, email, password_hash, full_name, phone
    from users
    where email = ${normalizedEmail} and deleted_at is null
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

  const token = signCustomerToken({ userId: user.id, email: user.email });
  const res = NextResponse.json({
    id: user.id,
    name: user.full_name,
    email: user.email,
    phone: user.phone,
  });
  res.cookies.set(CUSTOMER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return res;
}
