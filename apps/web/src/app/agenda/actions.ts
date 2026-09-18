"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppointmentConflictError, createAppointment, updateAppointmentStatus } from "@dentalos/database";
import type { AppointmentStatus } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { createAppointmentSchema } from "@/lib/validation/appointment";

export interface CreateAppointmentFormState {
  error?: string;
}

export async function createAppointmentAction(
  _prevState: CreateAppointmentFormState,
  formData: FormData,
): Promise<CreateAppointmentFormState> {
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

  const dateParam = parsed.data.startAt.toISOString().slice(0, 10);
  redirect(`/agenda?date=${dateParam}`);
}

export async function updateAppointmentStatusAction(appointmentId: string, status: AppointmentStatus): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.write");
  await updateAppointmentStatus(ctx, appointmentId, status);
  revalidatePath("/agenda");
}
