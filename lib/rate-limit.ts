import type { NextRequest } from "next/server";

// Best-effort in-memory rate limiter for auth-adjacent endpoints (login,
// register, order tracking) — slows down brute-force/credential-stuffing
// and order-number enumeration without adding an external dependency.
//
// Caveat: state is per server process. On a multi-instance deployment
// (e.g. several serverless/edge instances) each instance counts separately,
// so the *effective* limit is roughly (this limit × instance count). Good
// enough as a first line of defense for a single-region small-store app;
// swap for a shared store (Redis, Upstash) if this ever needs to be exact.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodic sweep so the map doesn't grow unbounded over the process lifetime.
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 5 * 60 * 1000);
sweepTimer.unref?.();

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Best-effort client IP from the standard proxy header (Vercel/most hosts set this). */
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
