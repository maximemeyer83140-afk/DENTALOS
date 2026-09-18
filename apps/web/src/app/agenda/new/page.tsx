import { listPatients, listPractitioners, listRooms } from "@dentalos/database";
import type { ReactNode } from "react";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

import { NewAppointmentForm } from "./NewAppointmentForm";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}): Promise<ReactNode> {
  const { date } = await searchParams;
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.write");

  const [practitioners, rooms, patients] = await Promise.all([
    listPractitioners(ctx),
    listRooms(ctx),
    listPatients(ctx),
  ]);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Nouveau rendez-vous</h1>
      <NewAppointmentForm
        defaultDate={date ?? new Date().toISOString().slice(0, 10)}
        practitioners={practitioners.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
        rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
        patients={patients.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
      />
    </main>
  );
}
