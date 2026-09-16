import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __dentalosPrisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client. Reused across Next.js hot reloads in development to avoid exhausting
 * the Postgres connection pool.
 */
export const prisma = globalThis.__dentalosPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__dentalosPrisma = prisma;
}

export * from "@prisma/client";
