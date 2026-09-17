import type { Prisma } from "@prisma/client";

/**
 * Computes the next patient number for a clinic (`{year}-{seq}`, e.g. "2026-0042"), scoped by
 * clinic and reset every calendar year. MUST be called from inside the same transaction that
 * creates the `Patient` row (see `createPatient` in `../repositories/patients.ts`) — computing it
 * outside that transaction would let two concurrent creations read the same count and collide.
 */
export async function nextPatientNumber(
  tx: Prisma.TransactionClient,
  clinicId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const countThisYear = await tx.patient.count({
    where: { clinicId, patientNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(countThisYear + 1).padStart(4, "0")}`;
}
