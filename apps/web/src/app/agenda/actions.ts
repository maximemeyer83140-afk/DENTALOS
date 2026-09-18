"use server";

import { revalidatePath } from "next/cache";

import {
  AppointmentConflictError,
  createAppointment,
  createPatient,
  listPatients,
  updateAppointment,
  updateAppointmentStatus,
} from "@dentalos/database";
import type { AppointmentStatus } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import {
  createAppointmentSchema,
  quickCreatePatientSchema,
  updateAppointmentSchema,
} from "@/lib/validation/appointment";

export interface AppointmentFormState {
  error?: string;
  ok?: boolean;
}

export async function createAppointmentAction(
  _prevState: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const parsed = createAppointmentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.write");

  try {
    await createAppointment(
      ctx,
      {
        patientId: parsed.data.patientId,
        practitionerId: parsed.data.practitionerId,
        roomId: parsed.data.roomId,
        appointmentTypeId: parsed.data.appointmentTypeId,
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
        notes: parsed.data.notes,
      },
      ctx.userId,
    );
  } catch (error) {
    if (error instanceof AppointmentConflictError) return { error: error.message };
    throw error;
  }

  revalidatePath("/agenda");
  return { ok: true };
}

export async function updateAppointmentAction(
  _prevState: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const parsed = updateAppointmentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.write");

  try {
    await updateAppointment(ctx, parsed.data.appointmentId, {
      patientId: parsed.data.patientId ?? null,
      practitionerId: parsed.data.practitionerId,
      roomId: parsed.data.roomId ?? null,
      appointmentTypeId: parsed.data.appointmentTypeId ?? null,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      notes: parsed.data.notes ?? null,
    });
  } catch (error) {
    if (error instanceof AppointmentConflictError) return { error: error.message };
    throw error;
  }

  revalidatePath("/agenda");
  return { ok: true };
}

/** Imperative reschedule for the calendar's drag-and-drop — a narrower, faster path than the full
 * edit form (only ever touches time), same conflict engine underneath. */
export async function rescheduleAppointmentByDragAction(
  appointmentId: string,
  startAt: Date,
  endAt: Date,
): Promise<{ error?: string }> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.write");
  try {
    await updateAppointment(ctx, appointmentId, { startAt, endAt });
  } catch (error) {
    if (error instanceof AppointmentConflictError) return { error: error.message };
    throw error;
  }
  revalidatePath("/agenda");
  return {};
}

export async function updateAppointmentStatusAction(appointmentId: string, status: AppointmentStatus): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.write");
  await updateAppointmentStatus(ctx, appointmentId, status);
  revalidatePath("/agenda");
}

export interface PatientSearchResult {
  id: string;
  name: string;
  dateOfBirth: string | null;
  phone: string | null;
}

/** Called directly from the booking modal's search box (debounced client-side), not form-bound. */
export async function searchPatientsAction(query: string): Promise<PatientSearchResult[]> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "patients.read");
  if (!query.trim()) return [];
  const patients = await listPatients(ctx, { search: query });
  return patients.slice(0, 8).map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
    phone: p.mobile ?? p.phone ?? null,
  }));
}

export interface QuickCreatePatientResult {
  error?: string;
  patient?: { id: string; name: string };
}

/** "+ Nouveau patient" without leaving the booking flow (ÉTAPE 1.2) — deliberately minimal (full
 * patient intake form is ÉTAPE 2). Reuses the same createPatient the full patient module uses, so
 * nothing about the record itself is second-class — just fewer fields collected up front. */
export async function quickCreatePatientAction(input: {
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
}): Promise<QuickCreatePatientResult> {
  const parsed = quickCreatePatientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "patients.write");
  const patient = await createPatient(
    ctx,
    { firstName: parsed.data.firstName, lastName: parsed.data.lastName, phone: parsed.data.phone, dateOfBirth: parsed.data.dateOfBirth },
    ctx.userId,
  );

  revalidatePath("/agenda");
  return { patient: { id: patient.id, name: `${patient.firstName} ${patient.lastName}` } };
}
