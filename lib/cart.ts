// lib/cart.ts
//
// Shared cart logic for the new schema (carts/cart_items/product_variants).
// Uses raw SQL for the same reason as lib/pricing.ts — these are brand-new
// tables and the generated Prisma model names haven't been confirmed yet.

import { prisma } from "./prisma";

export type CartItem = {
  id: string;
  variant_id: string;
  quantity: number;
  sku: string;
  size_label: string;
  price: number;
  stock_quantity: number;
  product_id: string;
  product_name: string;
  product_slug: string;
  image_url: string | null;
};

export type Cart = {
  cartId: string;
  items: CartItem[];
  subtotal: number;
};

export async function getOrCreateCartId(userId: string): Promise<string> {
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    select id from carts where user_id = ${userId} limit 1
  `;
  if (existing[0]) return existing[0].id;

  const created = await prisma.$queryRaw<{ id: string }[]>`
    insert into carts (user_id) values (${userId}::uuid) returning id
  `;
  return created[0].id;
}

export async function getCart(userId: string): Promise<Cart> {
  const cartId = await getOrCreateCartId(userId);

  const rows = await prisma.$queryRaw<(Omit<CartItem, "price"> & { price: string })[]>`
    select
      ci.id, ci.variant_id, ci.quantity,
      pv.sku, pv.size_label, pv.price, pv.stock_quantity,
      p.id as product_id, p.name as product_name, p.slug as product_slug, p.image_url
    from cart_items ci
    join product_variants pv on pv.id = ci.variant_id
    join products p on p.id = pv.product_id
    where ci.cart_id = ${cartId}::uuid
    order by ci.created_at asc
  `;

  const items = rows.map((r) => ({ ...r, price: Number(r.price) }));
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return { cartId, items, subtotal };
}

export async function addToCart(userId: string, variantId: string, quantity: number): Promise<Cart> {
  const variant = await prisma.$queryRaw<{ stock_quantity: number }[]>`
    select stock_quantity from product_variants where id = ${variantId}::uuid and is_active = true
  `;
  if (!variant[0]) throw new Error("VARIANT_NOT_FOUND");

  const cartId = await getOrCreateCartId(userId);

  const existingItem = await prisma.$queryRaw<{ id: string; quantity: number }[]>`
    select id, quantity from cart_items where cart_id = ${cartId}::uuid and variant_id = ${variantId}::uuid
  `;

  const nextQuantity = (existingItem[0]?.quantity ?? 0) + quantity;
  if (nextQuantity > variant[0].stock_quantity) throw new Error("OUT_OF_STOCK");

  if (existingItem[0]) {
    await prisma.$executeRaw`update cart_items set quantity = ${nextQuantity} where id = ${existingItem[0].id}::uuid`;
  } else {
    await prisma.$executeRaw`
      insert into cart_items (cart_id, variant_id, quantity)
      values (${cartId}::uuid, ${variantId}::uuid, ${quantity})
    `;
  }

  return getCart(userId);
}

export async function updateCartItemQuantity(
  userId: string,
  itemId: string,
  quantity: number
): Promise<Cart> {
  const cartId = await getOrCreateCartId(userId);

  if (quantity <= 0) {
    await prisma.$executeRaw`delete from cart_items where id = ${itemId}::uuid and cart_id = ${cartId}::uuid`;
    return getCart(userId);
  }

  const variant = await prisma.$queryRaw<{ stock_quantity: number }[]>`
    select pv.stock_quantity
    from cart_items ci join product_variants pv on pv.id = ci.variant_id
    where ci.id = ${itemId}::uuid and ci.cart_id = ${cartId}::uuid
  `;
  if (!variant[0]) throw new Error("ITEM_NOT_FOUND");
  if (quantity > variant[0].stock_quantity) throw new Error("OUT_OF_STOCK");

  await prisma.$executeRaw`
    update cart_items set quantity = ${quantity} where id = ${itemId}::uuid and cart_id = ${cartId}::uuid
  `;
  return getCart(userId);
}

export async function removeCartItem(userId: string, itemId: string): Promise<Cart> {
  const cartId = await getOrCreateCartId(userId);
  await prisma.$executeRaw`delete from cart_items where id = ${itemId}::uuid and cart_id = ${cartId}::uuid`;
  return getCart(userId);
}