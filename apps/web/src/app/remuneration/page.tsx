import Link from "next/link";
import type { ReactNode } from "react";

import { computeCaBreakdown, getActiveCompensationRule, listPractitioners } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { COMPENSATION_MODEL_LABEL, formatRate } from "@/lib/compensation";
import { requirePermission } from "@/lib/rbac";

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function chf(amount: number): string {
  return `CHF ${amount.toFixed(2)}`;
}

/**
 * ÉTAPE 18 : rémunération des praticiens — CompensationRule/CompensationStatement existaient au
 * schéma depuis la Phase 0 sans jamais avoir de repository ni d'UI. Un cabinet à plusieurs
 * praticiens associés a besoin de fixer le taux de rétrocession de chacun et de suivre le CA qui
 * sert de base au calcul — exactement la demande : "en tant qu'administrateur, mettre le % de
 * rétrocession, voir le CA".
 */
export default async function CompensationOverviewPage(): Promise<ReactNode> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "compensation.read");
  const practitioners = await listPractitioners(ctx);

  const now = new Date();
  const monthStart = startOfMonth(now);

  const rows = await Promise.all(
    practitioners.map(async (practitioner) => {
      const [rule, ca] = await Promise.all([
        getActiveCompensationRule(ctx, practitioner.id, now),
        computeCaBreakdown(ctx, practitioner.id, monthStart, now),
      ]);
      return { practitioner, rule, ca };
    }),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="remuneration" />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Rémunération</h1>
        <p className="text-sm text-muted-foreground">
          Taux de rétrocession et chiffre d&apos;affaires du mois en cours, par praticien.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Praticien</th>
              <th className="px-3 py-2">Modèle</th>
              <th className="px-3 py-2">Taux</th>
              <th className="px-3 py-2">Production (mois)</th>
              <th className="px-3 py-2">Facturé (mois)</th>
              <th className="px-3 py-2">Encaissé (mois)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ practitioner, rule, ca }) => (
              <tr key={practitioner.id}>
                <td className="px-3 py-2">
                  <Link href={`/remuneration/${practitioner.id}`} className="font-medium text-primary hover:underline">
                    {practitioner.firstName} {practitioner.lastName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm text-foreground">
                  {rule ? (COMPENSATION_MODEL_LABEL[rule.model] ?? rule.model) : <span className="text-muted-foreground">Aucun taux défini</span>}
                </td>
                <td className="px-3 py-2 font-mono text-sm text-foreground">{rule?.rate !== null && rule?.rate !== undefined ? formatRate(Number(rule.rate)) : "—"}</td>
                <td className="px-3 py-2 font-mono text-sm text-foreground">{chf(ca.production)}</td>
                <td className="px-3 py-2 font-mono text-sm text-foreground">{chf(ca.billed)}</td>
                <td className="px-3 py-2 font-mono text-sm text-foreground">{chf(ca.collected)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucun praticien.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
