import type { WaitingListEntry, WaitingListUrgency } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface AddToWaitingListInput {
  patientId: string;
  appointmentTypeId?: string | undefined;
  preferredPractitionerId?: string | undefined;
  desiredDurationMinutes?: number | undefined;
  urgency?: WaitingListUrgency | undefined;
  availabilityNotes?: string | undefined;
}

export async function listWaitingList(ctx: TenantContext): Promise<WaitingListEntry[]> {
  return prisma.waitingListEntry.findMany({
    where: { clinicId: ctx.clinicId, status: "waiting" },
    orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
  });
}

export async function addToWaitingList(
  ctx: TenantContext,
  input: AddToWaitingListInput,
): Promise<WaitingListEntry> {
  return prisma.waitingListEntry.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      appointmentTypeId: input.appointmentTypeId,
      preferredPractitionerId: input.preferredPractitionerId,
      desiredDurationMinutes: input.desiredDurationMinutes,
      urgency: input.urgency ?? "normal",
      availabilityNotes: input.availabilityNotes,
    },
  });
}

export async function removeFromWaitingList(
  ctx: TenantContext,
  entryId: string,
  status: "scheduled" | "cancelled",
): Promise<void> {
  const result = await prisma.waitingListEntry.updateMany({
    where: { id: entryId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: { status },
  });
  if (result.count === 0) throw new NotFoundError(`Waiting list entry ${entryId} not found`);
}
