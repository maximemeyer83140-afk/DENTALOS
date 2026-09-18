"use server";

import { redirect } from "next/navigation";

import { createPatient, findPotentialDuplicates } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { createPatientSchema } from "@/lib/validation/patient";

export interface DuplicateCandidate {
  id: string;
  name: string;
  patientNumber: string;
  reasons: string[];
}

export interface CreatePatientFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  duplicates?: DuplicateCandidate[];
}

/**
 * ÉTAPE 2 : "empêcher autant que possible la création accidentelle de doublons" — never blocks
 * creation, just shows what looks like the same person first. First submit runs the check; if
 * matches come back, the form re-renders with a warning instead of creating anything, and the
 * "Créer quand même" button resubmits the same data with `confirmDuplicate=true`, skipping the
 * check the second time.
 */
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

  if (!parsed.data.confirmDuplicate) {
    const duplicates = await findPotentialDuplicates(ctx, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      dateOfBirth: parsed.data.dateOfBirth,
      phone: parsed.data.phone,
      mobile: parsed.data.mobile,
      email: parsed.data.email,
    });
    if (duplicates.length > 0) {
      return {
        duplicates: duplicates.map((d) => ({
          id: d.patient.id,
          name: `${d.patient.firstName} ${d.patient.lastName}`,
          patientNumber: d.patient.patientNumber,
          reasons: d.reasons,
        })),
      };
    }
  }

  const patient = await createPatient(ctx, parsed.data, ctx.userId);

  redirect(`/patients/${patient.id}`);
}
