import Link from "next/link";
import type { ReactNode } from "react";

import { listRecalls } from "@dentalos/database";
import type { RecallStatus } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

import { RecallDashboardRow } from "./RecallDashboardRow";

const FILTERS = [
  { id: "open", label: "En cours", statuses: ["to_contact", "contacted", "scheduled"] as RecallStatus[] },
  { id: "all", label: "Tous", statuses: undefined },
] as const;

/**
 * ÉTAPE 10 : worklist clinique des rappels de contrôle — le recall n'a de valeur que s'il devient
 * une action visible chaque jour, pas une ligne enfouie dans une fiche patient (c'est le rôle du
 * "recall" chez ZaWin et du suivi de fidélisation patient en général).
 */
export default async function RecallsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}): Promise<ReactNode> {
  const { filter: rawFilter } = await searchParams;
  const filter = FILTERS.find((f) => f.id === rawFilter) ?? FILTERS[0];

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "recalls.read");
  const recalls = await listRecalls(ctx, { statuses: filter.statuses });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueCount = recalls.filter((r) => r.dueDate < today && r.status !== "declined").length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="rappels" />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Rappels de contrôle</h1>
          <p className="text-sm text-muted-foreground">
            {recalls.length} rappel(s){overdueCount > 0 ? ` · ${overdueCount} en retard` : ""}
          </p>
        </div>
        <Link href="/patients" className="text-sm font-medium text-primary hover:underline">
          ← Patients
        </Link>
      </div>

      <nav className="mb-4 flex gap-1 border-b border-border" aria-label="Filtres des rappels">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/rappels?filter=${f.id}`}
            aria-current={filter.id === f.id ? "page" : undefined}
            className={`px-3 py-2 text-sm font-medium ${
              filter.id === f.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">Motif</th>
              <th className="px-3 py-2">Échéance</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Action rapide</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recalls.map((recall) => (
              <RecallDashboardRow key={recall.id} recall={recall} isOverdue={recall.dueDate < today && recall.status !== "declined"} />
            ))}
            {recalls.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucun rappel à afficher.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
