"use server";

import { redirect } from "next/navigation";

import { createPatient } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { createPatientSchema } from "@/lib/validation/patient";

export interface CreatePatientFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createPatientAction(
  _prevState: CreatePatientFormState,
  formData: FormData,
): Promise<CreatePatientFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createPatientSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { error: "Corrige les champs indiqués.", fieldErrors };
  }

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "patients.write");
  const patient = await createPatient(ctx, parsed.data, ctx.userId);

  redirect(`/patients/${patient.id}`);
}
