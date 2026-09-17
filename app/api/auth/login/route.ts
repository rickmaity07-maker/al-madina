import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth";

interface AdminUserRow {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({ username: "", password: "" }));

  if (!username || !password) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const normalizedEmail = username.trim().toLowerCase();

  // 1. Check admin_users table directly using raw SQL
  const rows = await prisma.$queryRaw<AdminUserRow[]>`
    SELECT 
      id, 
      email, 
      password_hash as "passwordHash", 
      full_name as "fullName", 
      role
    FROM admin_users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `;
  const account = rows[0];

  if (account) {
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });

    const role = (account.role.toUpperCase() === "OWNER" ? "OWNER" : "STAFF") as Parameters<typeof signAdminToken>[0]["role"];

    const token = signAdminToken({ 
      username: account.email, 
      role, 
      adminId: account.id 
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  // 2. Fall back to the .env super-admin (always OWNER)
  const validUsername = process.env.ADMIN_USERNAME || "admin";
  const validPassword = process.env.ADMIN_PASSWORD || "admin";

  if (username !== validUsername || password !== validPassword) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = signAdminToken({ username, role: "OWNER", adminId: null });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}