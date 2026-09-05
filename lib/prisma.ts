import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across hot reloads in dev,
// and across serverless invocations where possible.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
