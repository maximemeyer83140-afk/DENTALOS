import type { ReactNode } from "react";

import { listAppointmentTypes, listAppointmentsForRange, listPractitioners, listRooms } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

import { AgendaClient, type AppointmentDTO, type ViewMode } from "./AgendaClient";

function parseDateParam(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y!, (m ?? 1) - 1, d);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monday-based week start, regardless of locale default. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}): Promise<ReactNode> {
  const { view: viewParam, date: dateParam } = await searchParams;
  const view: ViewMode = viewParam === "day" ? "day" : "week";
  const anchorDate = parseDateParam(dateParam);

  const rangeStart = view === "day" ? anchorDate : startOfWeek(anchorDate);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + (view === "day" ? 1 : 7));

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.read");

  const [appointments, practitioners, rooms, appointmentTypes] = await Promise.all([
    listAppointmentsForRange(ctx, rangeStart, rangeEnd),
    listPractitioners(ctx),
    listRooms(ctx),
    listAppointmentTypes(ctx),
  ]);

  const appointmentDTOs: AppointmentDTO[] = appointments.map((a) => ({
    id: a.id,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    status: a.status,
    notes: a.notes,
    patient: a.patient ? { id: a.patient.id, name: `${a.patient.firstName} ${a.patient.lastName}` } : null,
    practitioner: { id: a.practitioner.id, name: `${a.practitioner.firstName} ${a.practitioner.lastName}` },
    room: a.room ? { id: a.room.id, name: a.room.name } : null,
    appointmentType: a.appointmentType
      ? { id: a.appointmentType.id, name: a.appointmentType.name, color: a.appointmentType.color }
      : null,
  }));

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6">
      <AppNav current="agenda" />
      <AgendaClient
        view={view}
        anchorDate={toDateParam(anchorDate)}
        rangeStartIso={rangeStart.toISOString()}
        appointments={appointmentDTOs}
        practitioners={practitioners.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
        rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
        appointmentTypes={appointmentTypes.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          defaultDurationMinutes: t.defaultDurationMinutes,
        }))}
      />
    </main>
  );
}
