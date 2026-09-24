import Link from "next/link";
import type { ReactNode } from "react";

import { listWaitingList, listAppointmentsForRange } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

import { AddToWaitingListForm } from "./AddToWaitingListForm";
import { WaitingListRow } from "./WaitingListRow";

/**
 * Un patient en liste d'attente a déjà un rendez-vous fixé et souhaite une place plus tôt si un
 * autre patient annule — voir waiting-list.ts (WaitingListEntry.appointmentId, obligatoire). Le
 * formulaire d'ajout ne laisse donc jamais saisir un patient/type de rendez-vous librement : on
 * choisit parmi les rendez-vous déjà planifiés dans les 90 prochains jours.
 */
export default async function WaitingListPage(): Promise<ReactNode> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.read");

  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const [entries, upcomingAppointments] = await Promise.all([
    listWaitingList(ctx),
    listAppointmentsForRange(ctx, now, horizon),
  ]);

  const waitingAppointmentIds = new Set(entries.map((e) => e.appointmentId));
  const eligibleAppointments = upcomingAppointments.filter(
    (a) => a.patient && a.status !== "cancelled" && a.status !== "no_show" && !waitingAppointmentIds.has(a.id),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="liste-attente" />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Liste d&apos;attente</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} patient(s) en attente d&apos;un créneau plus tôt
          </p>
        </div>
        <Link href="/agenda" className="text-sm font-medium text-primary hover:underline">
          ← Agenda
        </Link>
      </div>

      <div className="mb-6">
        <AddToWaitingListForm appointments={eligibleAppointments} />
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">Rendez-vous prévu</th>
              <th className="px-3 py-2">Urgence</th>
              <th className="px-3 py-2">Notes de disponibilité</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <WaitingListRow key={entry.id} entry={entry} />
            ))}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucun patient en liste d&apos;attente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
