import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";

// Removes admin access only (deletes the admin_users role row) — the
// underlying users account, and any customer history on it, is untouched.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const { id } = await params;
  if (id === session?.adminId) {
    return NextResponse.json({ error: "You can't remove your own account while logged in as it." }, { status: 400 });
  }

  await prisma.$executeRaw`delete from admin_users where user_id = ${id}::uuid`.catch(() => null);
  return NextResponse.json({ ok: true });
}
