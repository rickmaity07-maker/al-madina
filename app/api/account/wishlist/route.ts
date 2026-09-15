import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

// Customer only: list wishlisted products (with sizes, so they can add straight to basket).
export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { wishlist: { include: { sizes: true } } },
  });

  return NextResponse.json(user?.wishlist ?? []);
}

// Customer only: add a product to the wishlist.
export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Please log in to save items." }, { status: 401 });

  const { productId } = await req.json().catch(() => ({}));
  if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });

  await prisma.user.update({
    where: { id: session.userId },
    data: { wishlist: { connect: { id: productId } } },
  });

  return NextResponse.json({ ok: true });
}
