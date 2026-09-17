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
export * from "./tenant-context";
export * from "./errors";
export * from "./repositories/practitioners";
export * from "./repositories/patients";
export * from "./repositories/medical-profile";
export * from "./repositories/medical-alerts";
export * from "./repositories/documents";
export * from "./services/patient-timeline";
export * from "./services/storage-provider";
