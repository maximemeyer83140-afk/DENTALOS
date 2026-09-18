import type { ClinicalNote, ClinicalNoteRevision } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface CreateClinicalNoteInput {
  practitionerId: string;
  appointmentId?: string | undefined;
  noteType?: string | undefined;
  content: string;
}

export async function listNotesForPatient(ctx: TenantContext, patientId: string): Promise<ClinicalNote[]> {
  return prisma.clinicalNote.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(
  ctx: TenantContext,
  patientId: string,
  input: CreateClinicalNoteInput,
  createdBy: string,
): Promise<ClinicalNote> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  return prisma.clinicalNote.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId,
      practitionerId: input.practitionerId,
      appointmentId: input.appointmentId,
      noteType: input.noteType ?? "consultation",
      content: input.content,
      createdBy,
    },
  });
}

/** A draft note can still be edited freely (not yet finalized, no clinical decisions rest on it
 * being immutable). Finalizing locks it — see `correctFinalizedNote` for what happens after. */
export async function finalizeNote(ctx: TenantContext, noteId: string): Promise<ClinicalNote> {
  const result = await prisma.clinicalNote.updateMany({
    where: { id: noteId, organizationId: ctx.organizationId, clinicId: ctx.clinicId, isFinalized: false },
    data: { isFinalized: true, finalizedAt: new Date() },
  });
  if (result.count === 0) {
    throw new NotFoundError(`Clinical note ${noteId} not found or already finalized`);
  }
  const note = await prisma.clinicalNote.findFirst({ where: { id: noteId } });
  if (!note) throw new NotFoundError(`Clinical note ${noteId} not found`);
  return note;
}

/**
 * The only sanctioned way to change a finalized note's content: the note's *current* content is
 * archived into a `ClinicalNoteRevision` before the new content replaces it, so the full editing
 * history stays reconstructable. Calling this on a non-finalized note is a programming error —
 * just update the draft directly instead.
 */
export async function correctFinalizedNote(
  ctx: TenantContext,
  noteId: string,
  newContent: string,
  reason: string,
  editedBy: string,
): Promise<ClinicalNote> {
  return prisma.$transaction(async (tx) => {
    const note = await tx.clinicalNote.findFirst({
      where: { id: noteId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    });
    if (!note) throw new NotFoundError(`Clinical note ${noteId} not found`);
    if (!note.isFinalized) {
      throw new Error("correctFinalizedNote called on a note that was never finalized — update the draft instead");
    }

    await tx.clinicalNoteRevision.create({
      data: { clinicalNoteId: noteId, content: note.content, reason, editedBy },
    });

    return tx.clinicalNote.update({ where: { id: noteId }, data: { content: newContent } });
  });
}

export async function listNoteRevisions(ctx: TenantContext, noteId: string): Promise<ClinicalNoteRevision[]> {
  const note = await prisma.clinicalNote.findFirst({
    where: { id: noteId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!note) throw new NotFoundError(`Clinical note ${noteId} not found`);
  return prisma.clinicalNoteRevision.findMany({ where: { clinicalNoteId: noteId }, orderBy: { editedAt: "desc" } });
}
