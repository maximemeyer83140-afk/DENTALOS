import Link from "next/link";
import type { ReactNode } from "react";

import { getClinicDashboard } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

function formatCHF(value: number): string {
  return `CHF ${value.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function Tile({
  label,
  value,
  detail,
  href,
  emphasis,
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string;
  emphasis?: "warning" | "danger";
}): ReactNode {
  const emphasisClass =
    emphasis === "danger" ? "border-red-200 bg-red-50" : emphasis === "warning" ? "border-amber-200 bg-amber-50" : "border-border";
  const content = (
    <div className={`rounded-md border p-4 ${emphasisClass}`}>
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold text-foreground">{value}</div>
      {detail ? <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}

/**
 * ÉTAPE 11 : tableau de bord clinique — un seul écran qui répond à "comment va le cabinet en ce
 * moment", inspiré des "statistiques exportables" mises en avant chez DentaGest. Chaque chiffre
 * vient d'une vraie agrégation (services/analytics.ts), jamais d'une valeur d'exemple.
 */
export default async function StatisticsPage(): Promise<ReactNode> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "analytics.read");
  const dashboard = await getClinicDashboard(ctx);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="statistiques" />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Statistiques</h1>
        <p className="text-sm text-muted-foreground">Vue d&apos;ensemble de l&apos;activité du cabinet.</p>
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Finances</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile label="Encaissé ce mois" value={formatCHF(dashboard.revenue.thisMonth)} />
          <Tile label="Encaissé depuis janvier" value={formatCHF(dashboard.revenue.yearToDate)} />
          <Tile
            label="Factures impayées"
            value={formatCHF(dashboard.unpaidInvoices.total)}
            detail={`${dashboard.unpaidInvoices.count} facture(s)`}
            emphasis={dashboard.unpaidInvoices.count > 0 ? "warning" : undefined}
          />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Activité clinique</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile
            label="Soins réalisés ce mois"
            value={String(dashboard.soinsThisMonth.count)}
            detail={formatCHF(dashboard.soinsThisMonth.total)}
          />
          <Tile label="RDV aujourd'hui" value={String(dashboard.appointments.today)} href="/agenda" />
          <Tile label="RDV cette semaine" value={String(dashboard.appointments.thisWeek)} href="/agenda" />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Devis (90 derniers jours)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile label="Taux d'acceptation" value={formatPercent(dashboard.quotes.acceptanceRate)} />
          <Tile label="Devis acceptés" value={String(dashboard.quotes.accepted)} />
          <Tile label="Devis refusés" value={String(dashboard.quotes.rejected)} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Suivi</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile
            label="Rappels en retard"
            value={String(dashboard.recallsOverdue)}
            href="/rappels"
            emphasis={dashboard.recallsOverdue > 0 ? "danger" : undefined}
          />
          <Tile label="Tâches ouvertes" value={String(dashboard.tasksOpen)} href="/taches" />
          <Tile label="Nouveaux patients ce mois" value={String(dashboard.newPatientsThisMonth)} href="/patients" />
        </div>
      </div>
    </main>
  );
}
