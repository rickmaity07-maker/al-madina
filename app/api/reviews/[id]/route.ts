import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";
import { getAdminSession } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customerSession, adminSession] = await Promise.all([getCustomerSession(), getAdminSession()]);

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });

  const isOwner = customerSession && review.userId === customerSession.userId;
  if (!isOwner && !adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.review.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
