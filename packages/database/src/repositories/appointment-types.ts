import type { AppointmentType } from "@prisma/client";

import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface CreateAppointmentTypeInput {
  name: string;
  defaultDurationMinutes: number;
  color?: string | undefined;
  instructions?: string | undefined;
  defaultPrice?: number | undefined;
}

export async function listAppointmentTypes(ctx: TenantContext): Promise<AppointmentType[]> {
  return prisma.appointmentType.findMany({
    where: { clinicId: ctx.clinicId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createAppointmentType(
  ctx: TenantContext,
  input: CreateAppointmentTypeInput,
): Promise<AppointmentType> {
  return prisma.appointmentType.create({
    data: {
      clinicId: ctx.clinicId,
      name: input.name,
      defaultDurationMinutes: input.defaultDurationMinutes,
      color: input.color,
      instructions: input.instructions,
      defaultPrice: input.defaultPrice,
    },
  });
}
