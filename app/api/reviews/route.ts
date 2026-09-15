import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

// Public: list reviews for a product, newest first, plus the average rating.
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }

  const reviews = await prisma.review.findMany({
    where: { productId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const count = reviews.length;
  const average = count === 0 ? 0 : reviews.reduce((sum, r) => sum + r.rating, 0) / count;

  return NextResponse.json({
    average: Math.round(average * 10) / 10,
    count,
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      createdAt: r.createdAt,
      authorName: r.user.name,
    })),
  });
}

// Customer only: leave one review per product.
export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Please log in to leave a review." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { productId, rating, title, comment } = body as {
    productId?: string;
    rating?: number;
    title?: string;
    comment?: string;
  };

  if (!productId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "productId and a rating from 1-5 are required." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  try {
    const review = await prisma.review.upsert({
      where: { productId_userId: { productId, userId: session.userId } },
      update: { rating, title: title?.trim() || null, comment: comment?.trim() || null },
      create: {
        productId,
        userId: session.userId,
        rating,
        title: title?.trim() || null,
        comment: comment?.trim() || null,
      },
    });
    return NextResponse.json(review, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save your review." }, { status: 500 });
  }
}
