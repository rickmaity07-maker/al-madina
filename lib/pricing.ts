// lib/pricing.ts
//
// Distance + subtotal based delivery fee calculation, backed by the
// store_settings / delivery_fee_rules tables from the new schema.
//
// Uses raw SQL ($queryRaw) rather than the generated Prisma Client API,
// since these are brand-new tables and `prisma db pull` may have named
// the models differently than the examples below assume. Once you've
// confirmed the generated model names in schema.prisma, these can be
// swapped for typed `prisma.<model>.findMany()` calls to match the rest
// of the codebase (see app/api/products/route.ts for that style).

import { prisma } from "./prisma";

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two coordinates, in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}

async function getStoreSetting<T>(key: string): Promise<T | null> {
  const rows = await prisma.$queryRaw<{ value: T }[]>`
    select value from store_settings where key = ${key}
  `;
  return rows[0]?.value ?? null;
}

export async function getStoreLocation(): Promise<LatLng | null> {
  return getStoreSetting<LatLng>("store_location");
}

export async function getMaxDeliveryDistanceKm(): Promise<number | null> {
  return getStoreSetting<number>("max_delivery_distance_km");
}

export async function getCartMinimum(): Promise<number> {
  const value = await getStoreSetting<number>("cart_minimum_amount");
  return value ?? 0;
}

type FeeRuleRow = { fee: string }; // numeric comes back as a string from pg

/**
 * Looks up the delivery fee for a given distance + subtotal against
 * delivery_fee_rules, picking the lowest-`priority` active rule whose
 * ranges contain both values.
 */
export async function getDeliveryFee(distanceKm: number, subtotal: number): Promise<number> {
  const rows = await prisma.$queryRaw<FeeRuleRow[]>`
    select fee
    from delivery_fee_rules
    where is_active = true
      and min_distance_km <= ${distanceKm}
      and (max_distance_km is null or max_distance_km > ${distanceKm})
      and min_subtotal <= ${subtotal}
      and (max_subtotal is null or max_subtotal > ${subtotal})
    order by priority asc
    limit 1
  `;

  if (rows.length === 0) {
    // Fail loudly rather than silently charging €0 — add a catch-all
    // rule (min_distance_km 0, min_subtotal 0) in delivery_fee_rules
    // to guarantee there's always a match.
    throw new Error(
      `No delivery_fee_rules row covers distance=${distanceKm}km, subtotal=€${subtotal}.`
    );
  }

  return Number(rows[0].fee);
}

export type DeliveryQuote =
  | { inRange: true; distanceKm: number; fee: number }
  | { inRange: false; distanceKm: number };

/**
 * Full quote for the checkout summary: validates the address is within
 * the store's service radius, then returns distance + fee together.
 */
export async function quoteDelivery(address: LatLng, subtotal: number): Promise<DeliveryQuote> {
  const store = await getStoreLocation();
  if (!store) throw new Error("store_settings.store_location is not set — seed it first.");

  const distanceKm = Math.round(haversineKm(store, address) * 10) / 10;

  const maxDistance = await getMaxDeliveryDistanceKm();
  if (maxDistance !== null && distanceKm > maxDistance) {
    return { inRange: false, distanceKm };
  }

  const fee = await getDeliveryFee(distanceKm, subtotal);
  return { inRange: true, distanceKm, fee };
}