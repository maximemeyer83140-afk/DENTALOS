import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

/**
 * Reference implementation of the repository pattern (ARCHITECTURE.md §5 / §4): every query is
 * explicitly scoped by `organizationId` AND `clinicId` from a verified `TenantContext`, never a
 * bare `prisma.practitioner.findMany()`. Every future repository (patients, appointments,
 * invoices, ...) follows this same shape.
 */
export async function listPractitioners(ctx: TenantContext) {
  return prisma.practitioner.findMany({
    where: { organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}
