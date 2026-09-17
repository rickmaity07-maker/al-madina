// app/api/cart/route.ts
//
// NOTE: getCustomerSession().userId must be the NEW users.id (uuid) from
// the migrated schema. If app/api/account/login/route.ts still issues
// sessions against the old User model's cuid, update it to look up
// `users` first — otherwise these queries will find no matching cart.

import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { getCart, addToCart, updateCartItemQuantity, removeCartItem } from "@/lib/cart";

async function requireUserId(): Promise<string | null> {
  const session = await getCustomerSession();
  return session?.userId ?? null;
}

function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  const status =
    message === "OUT_OF_STOCK" ? 409 : message === "VARIANT_NOT_FOUND" || message === "ITEM_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  return NextResponse.json(await getCart(userId));
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { variantId, quantity } = await req.json();
  if (!variantId || !quantity || quantity < 1) {
    return NextResponse.json({ error: "variantId and a positive quantity are required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await addToCart(userId, variantId, quantity), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { itemId, quantity } = await req.json();
  if (!itemId || quantity == null) {
    return NextResponse.json({ error: "itemId and quantity are required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await updateCartItemQuantity(userId, itemId, quantity));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { itemId } = await req.json();
  if (!itemId) return NextResponse.json({ error: "itemId is required." }, { status: 400 });

  try {
    return NextResponse.json(await removeCartItem(userId, itemId));
  } catch (err) {
    return errorResponse(err);
  }
}