import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export type TimelineEventType = "appointment" | "clinical_note" | "document";

export interface TimelineEvent {
  type: TimelineEventType;
  date: Date;
  title: string;
  detail?: string;
  entityId: string;
}

const EVENTS_PER_SOURCE = 50;

/**
 * Aggregates a patient's events into one chronological feed (section 7 of the brief — the
 * clinical timeline). Each future phase that adds a new patient-scoped entity (treatment plans,
 * invoices, payments, consents, ...) extends the `Promise.all` below with one more query; nothing
 * else about this function's shape changes.
 */
export async function getPatientTimeline(ctx: TenantContext, patientId: string): Promise<TimelineEvent[]> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  const [appointments, notes, documents] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId },
      orderBy: { startAt: "desc" },
      take: EVENTS_PER_SOURCE,
    }),
    prisma.clinicalNote.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: EVENTS_PER_SOURCE,
    }),
    prisma.document.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: EVENTS_PER_SOURCE,
    }),
  ]);

  const events: TimelineEvent[] = [
    ...appointments.map((appointment): TimelineEvent => ({
      type: "appointment",
      date: appointment.startAt,
      title: "Rendez-vous",
      detail: appointment.notes ?? undefined,
      entityId: appointment.id,
    })),
    ...notes.map((note): TimelineEvent => ({
      type: "clinical_note",
      date: note.createdAt,
      title: "Note clinique",
      detail: note.content.length > 140 ? `${note.content.slice(0, 140)}…` : note.content,
      entityId: note.id,
    })),
    ...documents.map((document): TimelineEvent => ({
      type: "document",
      date: document.createdAt,
      title: document.fileName,
      detail: document.category,
      entityId: document.id,
    })),
  ];

  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  return events;
}
