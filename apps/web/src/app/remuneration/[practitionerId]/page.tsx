import Link from "next/link";
import type { ReactNode } from "react";

import { getActiveCompensationRule, listCompensationRules, listCompensationStatements, listPractitioners } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { COMPENSATION_MODEL_LABEL, formatRate } from "@/lib/compensation";
import { requirePermission } from "@/lib/rbac";

import { GenerateStatementForm } from "../GenerateStatementForm";
import { SetRuleForm } from "../SetRuleForm";
import { StatementRow } from "../StatementRow";

function formatDate(date: Date | null): string {
  if (!date) return "en cours";
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export default async function PractitionerCompensationPage({
  params,
}: {
  params: Promise<{ practitionerId: string }>;
}): Promise<ReactNode> {
  const { practitionerId } = await params;
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "compensation.read");

  const [practitioners, rules, statements, activeRule] = await Promise.all([
    listPractitioners(ctx),
    listCompensationRules(ctx, practitionerId),
    listCompensationStatements(ctx, { practitionerId }),
    getActiveCompensationRule(ctx, practitionerId),
  ]);
  const practitioner = practitioners.find((p) => p.id === practitionerId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <AppNav current="remuneration" />
      <Link href="/remuneration" className="text-sm font-medium text-primary hover:underline">
        ← Rémunération
      </Link>

      <div className="mb-6 mt-3">
        <h1 className="text-2xl font-semibold text-foreground">
          {practitioner ? `${practitioner.firstName} ${practitioner.lastName}` : "Praticien"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeRule
            ? `${COMPENSATION_MODEL_LABEL[activeRule.model] ?? activeRule.model}${activeRule.rate !== null ? ` · ${formatRate(Number(activeRule.rate))}` : ""}`
            : "Aucun taux de rétrocession actif"}
        </p>
      </div>

      <div className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Taux de rétrocession</h2>
        <SetRuleForm practitionerId={practitionerId} />
        <ul className="mt-3 flex flex-col gap-2">
          {rules.map((rule) => (
            <li key={rule.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{COMPENSATION_MODEL_LABEL[rule.model] ?? rule.model}</span>
              {rule.rate !== null ? <span className="ml-2 font-mono text-foreground">{formatRate(Number(rule.rate))}</span> : null}
              <span className="ml-2 text-xs text-muted-foreground">
                du {formatDate(rule.validFrom)} au {formatDate(rule.validTo)}
              </span>
            </li>
          ))}
          {rules.length === 0 ? <li className="text-sm text-muted-foreground">Aucun taux défini pour l&apos;instant.</li> : null}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Décomptes ({statements.length})</h2>
        <div className="mb-3">
          <GenerateStatementForm practitionerId={practitionerId} />
        </div>
        <ul className="flex flex-col gap-2">
          {statements.map((statement) => (
            <StatementRow
              key={statement.id}
              practitionerId={practitionerId}
              statement={{
                id: statement.id,
                periodStart: statement.periodStart,
                periodEnd: statement.periodEnd,
                production: Number(statement.production),
                billed: Number(statement.billed),
                collected: Number(statement.collected),
                creditNotes: Number(statement.creditNotes),
                baseAmount: Number(statement.baseAmount),
                rateApplied: Number(statement.rateApplied),
                computedAmount: Number(statement.computedAmount),
                adjustments: Number(statement.adjustments),
                finalAmount: Number(statement.finalAmount),
                status: statement.status,
                notes: statement.notes,
              }}
            />
          ))}
          {statements.length === 0 ? <li className="text-sm text-muted-foreground">Aucun décompte généré.</li> : null}
        </ul>
      </div>
    </main>
  );
}
