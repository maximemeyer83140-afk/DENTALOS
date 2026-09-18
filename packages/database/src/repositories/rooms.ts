import type { Room } from "@prisma/client";

import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export async function listRooms(ctx: TenantContext): Promise<Room[]> {
  return prisma.room.findMany({
    where: { clinicId: ctx.clinicId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createRoom(ctx: TenantContext, name: string): Promise<Room> {
  return prisma.room.create({ data: { clinicId: ctx.clinicId, name } });
}
