import Link from "next/link";
import type { ReactNode } from "react";

import { listAppointmentsForDay } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

import { StatusActions } from "./StatusActions";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Planifié",
  confirmed: "Confirmé",
  arrived: "Arrivé",
  in_chair: "En fauteuil",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

function parseDateParam(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(date);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}): Promise<ReactNode> {
  const { date: dateParam } = await searchParams;
  const date = parseDateParam(dateParam);

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.read");
  const appointments = await listAppointmentsForDay(ctx, date);

  const previousDay = new Date(date);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("fr-CH", { dateStyle: "full", timeZone: "UTC" }).format(date)}
          </p>
        </div>
        <Link
          href={`/agenda/new?date=${toDateParam(date)}`}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Nouveau rendez-vous
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link href={`/agenda?date=${toDateParam(previousDay)}`} className="text-primary hover:underline">
          ← Jour précédent
        </Link>
        <Link href={`/agenda?date=${toDateParam(new Date())}`} className="text-primary hover:underline">
          Aujourd&apos;hui
        </Link>
        <Link href={`/agenda?date=${toDateParam(nextDay)}`} className="text-primary hover:underline">
          Jour suivant →
        </Link>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-md border border-border">
        {appointments.map((appointment) => (
          <div key={appointment.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-14 font-mono text-sm text-muted-foreground">{formatTime(appointment.startAt)}</span>
            <span className="min-w-[140px] flex-shrink-0 font-medium text-foreground">
              {appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : "—"}
            </span>
            {appointment.appointmentType ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {appointment.appointmentType.name}
              </span>
            ) : null}
            <span className="text-sm text-muted-foreground">
              {appointment.practitioner.firstName} {appointment.practitioner.lastName}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {STATUS_LABEL[appointment.status] ?? appointment.status}
            </span>
            <span className="flex-grow" />
            <StatusActions appointmentId={appointment.id} status={appointment.status} />
          </div>
        ))}
        {appointments.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun rendez-vous ce jour.</p>
        ) : null}
      </div>
    </main>
  );
}
