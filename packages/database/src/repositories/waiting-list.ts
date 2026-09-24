import type { WaitingListEntry, WaitingListUrgency } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

const CANCELLED_STATUSES = new Set(["cancelled", "no_show"]);
const ACTIVE_ENTRY_STATUSES = ["waiting", "offered"] as const;

export interface AddToWaitingListInput {
  appointmentId: string;
  urgency?: WaitingListUrgency | undefined;
  availabilityNotes?: string | undefined;
}

export type WaitingListEntryWithRelations = WaitingListEntry & {
  patient: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null };
  appointment: {
    id: string;
    startAt: Date;
    endAt: Date;
    practitioner: { id: string; firstName: string; lastName: string };
    appointmentType: { id: string; name: string } | null;
  };
};

const WAITING_LIST_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  appointment: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
      practitioner: { select: { id: true, firstName: true, lastName: true } },
      appointmentType: { select: { id: true, name: true } },
    },
  },
} as const;

export async function listWaitingList(ctx: TenantContext): Promise<WaitingListEntryWithRelations[]> {
  return prisma.waitingListEntry.findMany({
    where: { clinicId: ctx.clinicId, status: "waiting" },
    include: WAITING_LIST_INCLUDE,
    orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
  });
}

/**
 * La liste d'attente n'existe que pour un patient qui a déjà un rendez-vous fixé et qui
 * souhaiterait une place plus tôt si un créneau se libère par annulation — jamais un vœu libre
 * sans rendez-vous. `patientId` n'est donc jamais saisi séparément : il est toujours dérivé du
 * rendez-vous, qui doit exister dans le même tenant, porter un vrai patient (pas un créneau bloqué
 * sans patientId), ne pas déjà être annulé/manqué, et être encore à venir.
 */
export async function addToWaitingList(
  ctx: TenantContext,
  input: AddToWaitingListInput,
): Promise<WaitingListEntry> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
  if (!appointment) throw new NotFoundError(`Appointment ${input.appointmentId} not found`);
  if (!appointment.patientId) {
    throw new Error("Ce rendez-vous n'a pas de patient associé — impossible de le mettre en liste d'attente.");
  }
  if (CANCELLED_STATUSES.has(appointment.status)) {
    throw new Error("Ce rendez-vous est annulé ou manqué — impossible de le mettre en liste d'attente.");
  }
  if (appointment.startAt <= new Date()) {
    throw new Error("Ce rendez-vous est déjà passé — impossible de le mettre en liste d'attente.");
  }

  const existing = await prisma.waitingListEntry.findFirst({
    where: { appointmentId: input.appointmentId, status: { in: [...ACTIVE_ENTRY_STATUSES] } },
  });
  if (existing) {
    throw new Error("Ce rendez-vous est déjà en liste d'attente.");
  }

  return prisma.waitingListEntry.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId: appointment.patientId,
      appointmentId: appointment.id,
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

/**
 * Quand un créneau se libère (annulation), on veut retrouver les patients en attente compatibles :
 * même type de rendez-vous que celui annulé. Pas encore appelée depuis le flux d'annulation
 * (voir PHASE_17.md, Limitations connues) — prête côté repository pour cette intégration future.
 */
export async function findWaitingListMatchesForSlot(
  ctx: TenantContext,
  appointmentTypeId: string | null,
): Promise<WaitingListEntryWithRelations[]> {
  return prisma.waitingListEntry.findMany({
    where: {
      clinicId: ctx.clinicId,
      status: "waiting",
      appointment: { appointmentTypeId },
    },
    include: WAITING_LIST_INCLUDE,
    orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
  });
}
