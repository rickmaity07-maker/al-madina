// app/api/account/me/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

type UserRow = { id: string; name: string; email: string; phone: string | null; role: "OWNER" | "STAFF" | null };

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ user: null });

  const rows = await prisma.$queryRaw<UserRow[]>`
    select u.id, u.full_name as "name", u.email, u.phone, a.role
    from users u
    left join admin_users a on a.user_id = u.id
    where u.id = ${session.userId}::uuid and u.deleted_at is null
  `;
  const user = rows[0];
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({ user });
}
