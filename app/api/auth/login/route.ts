import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { signAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** Constant-time string comparison so a wrong-length/wrong-content guess can't be timed. */
function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

interface AdminUserRow {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: "OWNER" | "STAFF";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const { allowed } = rateLimit(`admin-login:${ip}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many login attempts. Please try again in a minute." }, { status: 429 });
  }

  const { username, password } = await req.json().catch(() => ({ username: "", password: "" }));

  if (!username || !password) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const normalizedEmail = username.trim().toLowerCase();

  // 1. admin_users is a role marker on top of users (user_id, role) — the
  // actual credentials (email, password_hash, full_name) live in users.
  // This is the same shared-login join getAdminSession() uses in lib/auth.ts.
  const rows = await prisma.$queryRaw<AdminUserRow[]>`
    SELECT
      u.id,
      u.email,
      u.password_hash as "passwordHash",
      u.full_name as "fullName",
      a.role
    FROM users u
    JOIN admin_users a ON a.user_id = u.id
    WHERE u.email = ${normalizedEmail} AND u.deleted_at IS NULL
    LIMIT 1
  `;
  const account = rows[0];

  if (account) {
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });

    const token = signAdminToken({
      username: account.email,
      role: account.role,
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

  // 2. Fall back to the .env super-admin (always OWNER). Disabled entirely if
  // either var isn't set — no "admin"/"admin" default to fall through to.
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (
    !validUsername ||
    !validPassword ||
    !safeEqual(username, validUsername) ||
    !safeEqual(password, validPassword)
  ) {
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