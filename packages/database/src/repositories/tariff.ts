import type { TariffItem } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

/**
 * Reads the clinic's organization-scoped tariff catalog (section 79: never hardcode a tariff in
 * business logic — always resolve it from this versioned catalog). Only the currently active
 * version's items are exposed; switching versions (e.g. a yearly SSO/DENTOTAR revision) is a data
 * change, not a code change.
 */
export async function listActiveTariffItems(ctx: TenantContext): Promise<TariffItem[]> {
  return prisma.tariffItem.findMany({
    where: {
      tariffVersion: {
        isActive: true,
        catalog: { organizationId: ctx.organizationId },
      },
    },
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });
}

export async function getTariffItem(ctx: TenantContext, tariffItemId: string): Promise<TariffItem> {
  const item = await prisma.tariffItem.findFirst({
    where: {
      id: tariffItemId,
      tariffVersion: { catalog: { organizationId: ctx.organizationId } },
    },
  });
  if (!item) throw new NotFoundError(`Tariff item ${tariffItemId} not found`);
  return item;
}
