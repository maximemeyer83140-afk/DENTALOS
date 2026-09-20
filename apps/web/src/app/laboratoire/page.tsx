import Link from "next/link";
import type { ReactNode } from "react";

import { listLabCases, listLaboratories } from "@dentalos/database";
import type { LabCaseStatus } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

import { CreateLaboratoryForm } from "./CreateLaboratoryForm";
import { LabCaseDashboardRow } from "./LabCaseDashboardRow";

const FILTERS = [
  {
    id: "open",
    label: "En cours",
    statuses: ["to_send", "sent", "in_production", "received", "fitted"] as LabCaseStatus[],
  },
  { id: "all", label: "Toutes", statuses: undefined },
] as const;

/**
 * ÉTAPE 17 : worklist clinique des travaux de laboratoire — un cas "envoyé" dont le retour attendu
 * est dépassé doit se voir au premier coup d'œil, exactement comme le worklist des rappels
 * (Phase 6) et des tâches (Phase 7).
 */
export default async function LaboratoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}): Promise<ReactNode> {
  const { filter: rawFilter } = await searchParams;
  const filter = FILTERS.find((f) => f.id === rawFilter) ?? FILTERS[0];

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "laboratory.read");
  const [labCases, laboratories] = await Promise.all([listLabCases(ctx, { statuses: filter.statuses }), listLaboratories(ctx)]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = (labCase: (typeof labCases)[number]): boolean =>
    Boolean(labCase.expectedAt && labCase.expectedAt < today && labCase.status !== "completed");
  const overdueCount = labCases.filter(isOverdue).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="laboratoire" />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Laboratoire</h1>
          <p className="text-sm text-muted-foreground">
            {labCases.length} cas{overdueCount > 0 ? ` · ${overdueCount} en retard` : ""}
          </p>
        </div>
        <Link href="/patients" className="text-sm font-medium text-primary hover:underline">
          ← Patients
        </Link>
      </div>

      <nav className="mb-4 flex gap-1 border-b border-border" aria-label="Filtres des travaux de laboratoire">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/laboratoire?filter=${f.id}`}
            aria-current={filter.id === f.id ? "page" : undefined}
            className={`px-3 py-2 text-sm font-medium ${
              filter.id === f.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="mb-8 overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">Travail</th>
              <th className="px-3 py-2">Laboratoire</th>
              <th className="px-3 py-2">Retour attendu</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Action rapide</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {labCases.map((labCase) => (
              <LabCaseDashboardRow key={labCase.id} labCase={labCase} isOverdue={isOverdue(labCase)} />
            ))}
            {labCases.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucun cas à afficher.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Laboratoires ({laboratories.length})</h2>
        <div className="mb-3">
          <CreateLaboratoryForm />
        </div>
        <ul className="flex flex-col gap-2">
          {laboratories.map((lab) => (
            <li key={lab.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{lab.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{[lab.phone, lab.email].filter(Boolean).join(" · ") || "—"}</span>
            </li>
          ))}
          {laboratories.length === 0 ? <li className="text-sm text-muted-foreground">Aucun laboratoire.</li> : null}
        </ul>
      </div>
    </main>
  );
}
