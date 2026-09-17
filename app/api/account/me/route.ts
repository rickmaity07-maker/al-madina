// app/api/account/me/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

type UserRow = { id: string; name: string; email: string; phone: string | null };

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ user: null });

  const rows = await prisma.$queryRaw<UserRow[]>`
    select id, full_name as "name", email, phone
    from users
    where id = ${session.userId}::uuid and deleted_at is null
  `;
  const user = rows[0];
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({ user });
}
