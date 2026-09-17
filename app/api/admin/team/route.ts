import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const accounts = await prisma.adminUser.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const { name, email, password, role } = await req.json().catch(() => ({}));
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (role !== "OWNER" && role !== "STAFF") {
    return NextResponse.json({ error: "Role must be OWNER or STAFF." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
  if (existing) return NextResponse.json({ error: "An admin account with this email already exists." }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.adminUser.create({
    data: { name: name.trim(), email: normalizedEmail, passwordHash, role },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(created, { status: 201 });
}
