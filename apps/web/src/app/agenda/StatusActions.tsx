"use client";

import type { AppointmentStatus } from "@dentalos/database";
import { useTransition } from "react";
import type { ReactNode } from "react";

import { updateAppointmentStatusAction } from "./actions";

const NEXT_STATUS: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string }[]>> = {
  scheduled: [
    { to: "confirmed", label: "Confirmer" },
    { to: "cancelled", label: "Annuler" },
  ],
  confirmed: [
    { to: "arrived", label: "Marquer arrivé" },
    { to: "cancelled", label: "Annuler" },
  ],
  arrived: [{ to: "in_chair", label: "Installer au fauteuil" }],
  in_chair: [{ to: "completed", label: "Terminer" }],
};

export function StatusActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
}): ReactNode {
  const [isPending, startTransition] = useTransition();
  const actions = NEXT_STATUS[status] ?? [];

  if (actions.length === 0) return null;

  return (
    <div className="flex gap-1">
      {actions.map((action) => (
        <button
          key={action.to}
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => updateAppointmentStatusAction(appointmentId, action.to))}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
