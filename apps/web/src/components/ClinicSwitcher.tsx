"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useTransition } from "react";

import { setActiveClinicAction } from "@/app/clinic-actions";

export interface ClinicOption {
  clinicId: string;
  clinicName: string;
}

/** Only rendered when the user has access to more than one clinic — a single-clinic cabinet
 * (the common case) never sees a dropdown with nothing to choose from. */
export function ClinicSwitcher({ clinics, activeClinicId }: { clinics: ClinicOption[]; activeClinicId: string }): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (clinics.length <= 1) return null;

  return (
    <select
      value={activeClinicId}
      disabled={pending}
      onChange={(e) => {
        const clinicId = e.target.value;
        startTransition(async () => {
          await setActiveClinicAction(clinicId);
          router.refresh();
        });
      }}
      className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-60"
      aria-label="Clinique active"
    >
      {clinics.map((c) => (
        <option key={c.clinicId} value={c.clinicId}>
          {c.clinicName}
        </option>
      ))}
    </select>
  );
}
