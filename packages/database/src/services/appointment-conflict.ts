import type { Prisma } from "@prisma/client";

export class AppointmentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentConflictError";
  }
}

export interface ConflictCheckInput {
  clinicId: string;
  practitionerId: string;
  roomId?: string | null | undefined;
  startAt: Date;
  endAt: Date;
  /** Pass the appointment's own id when rescheduling, so it doesn't conflict with itself. */
  excludeAppointmentId?: string | undefined;
}

/**
 * The server-side conflict engine (section 18/82 of the brief): a slot is unavailable if the same
 * practitioner OR the same room already has a non-cancelled appointment overlapping it. MUST be
 * called from inside the same transaction that writes the appointment — checking it beforehand in
 * a separate query would leave a window for two concurrent bookings to both pass the check and
 * both write (the exact race the brief calls out: "deux réceptionnistes réservent simultanément
 * le même fauteuil").
 */
export async function assertNoConflict(
  tx: Prisma.TransactionClient,
  input: ConflictCheckInput,
): Promise<void> {
  const overlapping = await tx.appointment.findFirst({
    where: {
      clinicId: input.clinicId,
      status: { not: "cancelled" },
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
      ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
      OR: [
        { practitionerId: input.practitionerId },
        ...(input.roomId ? [{ roomId: input.roomId }] : []),
      ],
    },
    select: { id: true, practitionerId: true, roomId: true, startAt: true, endAt: true },
  });

  if (!overlapping) return;

  const reason =
    overlapping.practitionerId === input.practitionerId
      ? "Le praticien a déjà un rendez-vous sur ce créneau."
      : "La salle est déjà occupée sur ce créneau.";
  throw new AppointmentConflictError(reason);
}
