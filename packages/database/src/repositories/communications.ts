import type { Communication, CommunicationChannel, CommunicationDirection } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface LogCommunicationInput {
  patientId: string;
  channel: CommunicationChannel;
  direction?: CommunicationDirection | undefined;
  subject?: string | undefined;
  content?: string | undefined;
  relatedEntityType?: string | undefined;
  relatedEntityId?: string | undefined;
}

/** Manual log entry — DentalOS doesn't send the SMS/email itself yet (see PHASE_6.md limitations),
 * this just records that contact happened so the patient's history is never a black hole between
 * two recalls. */
export async function logCommunication(
  ctx: TenantContext,
  input: LogCommunicationInput,
  createdBy: string,
): Promise<Communication> {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${input.patientId} not found`);

  return prisma.communication.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      channel: input.channel,
      direction: input.direction ?? "outbound",
      subject: input.subject,
      content: input.content,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      sentAt: new Date(),
      createdBy,
    },
  });
}

export async function listCommunicationsForPatient(
  ctx: TenantContext,
  patientId: string,
): Promise<Communication[]> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  return prisma.communication.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { createdAt: "desc" },
  });
}
