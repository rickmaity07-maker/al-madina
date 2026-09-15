import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { productId } = await params;
  await prisma.user.update({
    where: { id: session.userId },
    data: { wishlist: { disconnect: { id: productId } } },
  });

  return NextResponse.json({ ok: true });
}
