// Single source of truth for the JWT signing secret, shared by lib/auth.ts,
// lib/customer-auth.ts and middleware.ts (which can't import those directly —
// it runs on the edge runtime and they pull in Prisma/next/headers).
//
// Deliberately fails closed: an app that can silently fall back to a
// well-known secret means anyone can forge admin/customer session tokens.
// Better to crash on boot than to run "securely" with a public secret.
const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  throw new Error(
    "JWT_SECRET is missing or too short. Set it in your environment to a long random string " +
      "(e.g. `openssl rand -base64 48`) — at least 32 characters."
  );
}

export const JWT_SECRET = secret;
