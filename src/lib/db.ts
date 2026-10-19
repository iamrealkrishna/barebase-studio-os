import { PrismaClient } from "@prisma/client";

// Reuse the client across hot reloads in dev and across warm lambda invocations
// in production, so we don't exhaust the connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Transaction options for the writes that loop over rows.
 *
 * Prisma's default interactive-transaction timeout is 5 seconds, which a
 * 250-row rate card save or a whole-BOQ save can exceed on a slow connection —
 * the transaction then expires mid-commit and the whole write is lost with a
 * P2028. These writes are inherently row-by-row (ids have to stay stable, so
 * they're updates, not a delete-and-recreate), so the fix is to let them take
 * the time they need rather than to do less work.
 */
export const BULK_TX = { timeout: 30_000, maxWait: 10_000 } as const;
