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
export * from "./repositories/rooms";
export * from "./repositories/appointment-types";
export * from "./repositories/appointments";
export * from "./repositories/waiting-list";
export * from "./repositories/dental-chart";
export * from "./repositories/clinical-notes";
export * from "./repositories/treatment-plans";
export * from "./repositories/quotes";
export * from "./repositories/invoices";
export * from "./repositories/payments";
export * from "./repositories/credit-notes";
export * from "./repositories/tariff";
export * from "./services/patient-timeline";
export * from "./services/storage-provider";
export * from "./services/appointment-conflict";
export * from "./services/quote-calculator";
export * from "./services/invoice-calculator";
export * from "./services/swiss-qr-bill";
export * from "./services/tariff-pricing";
