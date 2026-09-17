// app/api/account/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signCustomerToken, CUSTOMER_COOKIE_NAME } from "@/lib/customer-auth";

type UserRow = { id: string; email: string; full_name: string; phone: string | null };

export async function POST(req: NextRequest) {
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
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
  return res;
}
