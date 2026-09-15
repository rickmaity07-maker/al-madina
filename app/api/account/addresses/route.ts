import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const addresses = await prisma.address.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(addresses);
}

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { label, address, isDefault } = await req.json().catch(() => ({}));
  if (!label || !address) {
    return NextResponse.json({ error: "label and address are required." }, { status: 400 });
  }

  if (isDefault) {
    await prisma.address.updateMany({ where: { userId: session.userId }, data: { isDefault: false } });
  }

  const created = await prisma.address.create({
    data: { userId: session.userId, label, address, isDefault: !!isDefault },
  });
  return NextResponse.json(created, { status: 201 });
}
