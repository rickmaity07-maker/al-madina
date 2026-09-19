// app/api/account/wishlist/[productId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { productId } = await params;
  await prisma.$executeRaw`
    delete from wishlists where user_id = ${session.userId}::uuid and product_id = ${productId}::uuid
  `;

  return NextResponse.json({ ok: true });
}
