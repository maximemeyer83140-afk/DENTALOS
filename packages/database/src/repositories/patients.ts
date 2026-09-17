import { Prisma, type AcquisitionSource, type Locale, type Patient } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import { nextPatientNumber } from "../services/patient-number";
import type { TenantContext } from "../tenant-context";

const MAX_CREATE_ATTEMPTS = 3;

// Optional fields are typed `T | undefined` (not just `T`), on purpose: with
// `exactOptionalPropertyTypes` enabled, that is what lets a zod-parsed object — whose `.optional()`
// fields are always present with a possibly-`undefined` value, never just omitted — be passed
// straight through from a Server Action without every caller having to strip `undefined` keys first.
export interface CreatePatientInput {
  title?: string | undefined;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date | undefined;
  sex?: string | undefined;
  language?: Locale | undefined;
  nationality?: string | undefined;
  addressLine1?: string | undefined;
  addressLine2?: string | undefined;
  npa?: string | undefined;
  city?: string | undefined;
  canton?: string | undefined;
  country?: string | undefined;
  phone?: string | undefined;
  mobile?: string | undefined;
  email?: string | undefined;
  legalGuardianName?: string | undefined;
  referringPhysician?: string | undefined;
  referringDentist?: string | undefined;
  acquisitionSource?: AcquisitionSource | undefined;
}

export type UpdatePatientInput = Partial<CreatePatientInput>;

export interface ListPatientsOptions {
  search?: string;
}

/**
 * Reference repository for patients (ARCHITECTURE.md §5): every query is explicitly scoped by
 * `organizationId` + `clinicId` from a verified `TenantContext`. `getPatient`/`updatePatient` use
 * `findFirst`/`updateMany` rather than `findUnique`/`update` on `id` alone precisely so the tenant
 * filter can never be bypassed by an id that happens to belong to another organization.
 */
export async function listPatients(ctx: TenantContext, options: ListPatientsOptions = {}): Promise<Patient[]> {
  const search = options.search?.trim();
  return prisma.patient.findMany({
    where: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { patientNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getPatient(ctx: TenantContext, patientId: string): Promise<Patient> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);
  return patient;
}

export async function createPatient(
  ctx: TenantContext,
  input: CreatePatientInput,
  createdBy: string,
): Promise<Patient> {
  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const patientNumber = await nextPatientNumber(tx, ctx.clinicId);
          return tx.patient.create({
            data: {
              organizationId: ctx.organizationId,
              clinicId: ctx.clinicId,
              patientNumber,
              ...input,
              createdBy,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const isRetryableConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002");
      if (!isRetryableConflict || attempt === MAX_CREATE_ATTEMPTS) throw error;
    }
  }
  // Unreachable: the loop above always either returns or throws.
  throw new Error("createPatient: exhausted retry attempts without a definitive result");
}

export async function updatePatient(
  ctx: TenantContext,
  patientId: string,
  input: UpdatePatientInput,
): Promise<Patient> {
  const result = await prisma.patient.updateMany({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: input,
  });
  if (result.count === 0) throw new NotFoundError(`Patient ${patientId} not found`);
  return getPatient(ctx, patientId);
}
