import Link from "next/link";
import type { ReactNode } from "react";

import {
  computeTariffItemPrice,
  getCurrentChart,
  getMedicalProfile,
  getPatient,
  getPatientTimeline,
  listActiveAlerts,
  listActiveTariffItems,
  listDocumentsForPatient,
  listInvoicesForPatient,
  listMedicalProfileRevisions,
  listNotesForPatient,
  listPaymentsForPatient,
  listPractitioners,
  listQuotesForPatient,
  listTreatmentPlansForPatient,
} from "@dentalos/database";
import type { DentalConditionType } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

import { AlertForm } from "./AlertForm";
import { InvoiceButton } from "./InvoiceButton";
import { ValidateInvoiceButton } from "./InvoiceActions";
import { MedicalProfileForm } from "./MedicalProfileForm";
import { NoteForm } from "./NoteForm";
import { FinalizeNoteButton } from "./NoteActions";
import { Odontogram } from "./Odontogram";
import { PaymentForm } from "./PaymentForm";
import { QuoteButton } from "./QuoteButton";
import { TreatmentPlanForm, type TariffItemOption } from "./TreatmentPlanForm";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "clinical", label: "Dossier médical" },
  { id: "chart", label: "Clinique" },
  { id: "billing", label: "Facturation" },
  { id: "documents", label: "Documents" },
  { id: "timeline", label: "Timeline" },
] as const;

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired: "Expiré",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  issued: "Émise",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
  credited: "Créditée",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  twint: "TWINT",
  bank_transfer: "Virement",
  qr_bill: "QR-facture",
  other: "Autre",
};

const ALERT_SEVERITY_CLASS: Record<string, string> = {
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  critical: "bg-red-50 text-red-700",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.id === rawTab) ? rawTab! : "overview";

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "patients.read");

  const patient = await getPatient(ctx, id);
  const alerts = await listActiveAlerts(ctx, id);

  let tabContent: ReactNode;
  if (tab === "clinical") {
    const [profile, revisions] = await Promise.all([
      getMedicalProfile(ctx, id),
      listMedicalProfileRevisions(ctx, id),
    ]);
    tabContent = (
      <div className="flex flex-col gap-6">
        <MedicalProfileForm
          patientId={id}
          allergies={profile?.allergies ?? []}
          medications={profile?.medications ?? []}
          conditions={profile?.conditions ?? []}
          riskNotes={profile?.riskNotes ?? null}
          isPregnant={profile?.isPregnant ?? null}
          isSmoker={profile?.isSmoker ?? null}
          onAnticoagulants={profile?.onAnticoagulants ?? null}
        />
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Alertes actives ({alerts.length})
          </h2>
          <ul className="mb-3 flex flex-col gap-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={`rounded-md px-3 py-2 text-sm ${ALERT_SEVERITY_CLASS[alert.severity] ?? "bg-muted"}`}
              >
                {alert.label}
              </li>
            ))}
            {alerts.length === 0 ? (
              <li className="text-sm text-muted-foreground">Aucune alerte active.</li>
            ) : null}
          </ul>
          <AlertForm patientId={id} />
        </div>
        {revisions.length > 0 ? (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Historique des versions ({revisions.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Version actuelle : {profile?.version ?? 1}. {revisions.length} révision(s) précédente(s)
              conservée(s) — jamais écrasées.
            </p>
          </div>
        ) : null}
      </div>
    );
  } else if (tab === "chart") {
    const [chart, notes, practitioners, plans, tariffItems] = await Promise.all([
      getCurrentChart(ctx, id),
      listNotesForPatient(ctx, id),
      listPractitioners(ctx),
      listTreatmentPlansForPatient(ctx, id),
      listActiveTariffItems(ctx),
    ]);
    const conditions: Record<number, DentalConditionType> = {};
    for (const entry of chart?.entries ?? []) {
      conditions[entry.toothNumber] = entry.condition;
    }
    const practitionerOptions = practitioners.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }));
    const tariffOptions: TariffItemOption[] = tariffItems.map((item) => {
      let price: number | null;
      try {
        price = computeTariffItemPrice(item);
      } catch {
        price = null;
      }
      return { id: item.id, code: item.code, description: item.description, category: item.category ?? "Autres", price };
    });
    const quotesByPatient = await listQuotesForPatient(ctx, id);

    tabContent = (
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Odontogramme</h2>
          <Odontogram patientId={id} conditions={conditions} />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Notes cliniques ({notes.length})</h2>
          <ul className="mb-3 flex flex-col gap-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</span>
                  {note.isFinalized ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Finalisée</span>
                  ) : (
                    <FinalizeNoteButton patientId={id} noteId={note.id} />
                  )}
                </div>
                <p className="text-foreground">{note.content}</p>
              </li>
            ))}
            {notes.length === 0 ? <li className="text-sm text-muted-foreground">Aucune note.</li> : null}
          </ul>
          <NoteForm patientId={id} practitioners={practitionerOptions} />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Plan de traitement</h2>
          <ul className="mb-3 flex flex-col gap-3">
            {plans.map((plan) => (
              <li key={plan.id} className="rounded-md border border-border p-3">
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{plan.status}</div>
                {plan.options.map((option) => (
                  <div key={option.id} className="mb-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{option.label}</span>
                      <QuoteButton patientId={id} treatmentPlanOptionId={option.id} />
                    </div>
                    <ul className="flex flex-col gap-1">
                      {option.items.map((item) => (
                        <li key={item.id} className="flex justify-between text-sm text-muted-foreground">
                          <span>
                            {item.description}
                            {item.toothNumber ? ` (dent ${item.toothNumber})` : ""}
                          </span>
                          <span className="font-mono">CHF {item.unitPrice.toString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </li>
            ))}
            {plans.length === 0 ? <li className="text-sm text-muted-foreground">Aucun plan de traitement.</li> : null}
          </ul>
          <TreatmentPlanForm patientId={id} practitioners={practitionerOptions} tariffItems={tariffOptions} />
        </div>

        {quotesByPatient.length > 0 ? (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Devis</h2>
            <ul className="flex flex-col gap-2">
              {quotesByPatient.map((quote) => (
                <li key={quote.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-mono">{quote.quoteNumber}</span>
                  <span className="text-muted-foreground">{QUOTE_STATUS_LABEL[quote.status] ?? quote.status}</span>
                  <span className="font-mono">CHF {quote.total.toString()}</span>
                  {quote.status === "accepted" ? <InvoiceButton patientId={id} quoteId={quote.id} /> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  } else if (tab === "billing") {
    const [invoices, payments] = await Promise.all([
      listInvoicesForPatient(ctx, id),
      listPaymentsForPatient(ctx, id),
    ]);
    const payableInvoices = invoices
      .filter((invoice) => invoice.status === "issued" || invoice.status === "partially_paid")
      .map((invoice) => ({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, balance: invoice.balance.toString() }));

    tabContent = (
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Factures ({invoices.length})</h2>
          <ul className="flex flex-col gap-2">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-mono">{invoice.invoiceNumber}</span>
                <span className="text-muted-foreground">{INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}</span>
                <span className="font-mono">CHF {invoice.total.toString()}</span>
                <span className="font-mono text-muted-foreground">solde CHF {invoice.balance.toString()}</span>
                {invoice.status === "draft" ? <ValidateInvoiceButton patientId={id} invoiceId={invoice.id} /> : null}
              </li>
            ))}
            {invoices.length === 0 ? <li className="text-sm text-muted-foreground">Aucune facture.</li> : null}
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Paiements ({payments.length})</h2>
          <ul className="mb-3 flex flex-col gap-2">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="text-muted-foreground">{formatDateTime(payment.paidAt)}</span>
                <span>{PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}</span>
                <span className="font-mono">CHF {payment.amount.toString()}</span>
              </li>
            ))}
            {payments.length === 0 ? <li className="text-sm text-muted-foreground">Aucun paiement.</li> : null}
          </ul>
          <PaymentForm patientId={id} invoices={payableInvoices} />
        </div>
      </div>
    );
  } else if (tab === "documents") {
    const documents = await listDocumentsForPatient(ctx, id);
    tabContent = (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          L&apos;envoi de fichiers arrive avec le branchement d&apos;un vrai fournisseur de
          stockage — l&apos;interface <code>StorageProvider</code> existe déjà côté serveur.
        </p>
        <ul className="divide-y divide-border rounded-md border border-border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{doc.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {doc.category} · {formatDate(doc.createdAt)}
              </span>
            </li>
          ))}
          {documents.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun document.</li>
          ) : null}
        </ul>
      </div>
    );
  } else if (tab === "timeline") {
    const events = await getPatientTimeline(ctx, id);
    tabContent = (
      <ol className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={`${event.type}-${event.entityId}`} className="rounded-md border border-border px-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="uppercase tracking-wide">{event.type.replace("_", " ")}</span>
              <span>{formatDateTime(event.date)}</span>
            </div>
            <p className="text-sm font-medium text-foreground">{event.title}</p>
            {event.detail ? <p className="text-sm text-muted-foreground">{event.detail}</p> : null}
          </li>
        ))}
        {events.length === 0 ? (
          <li className="text-sm text-muted-foreground">Aucun événement pour l&apos;instant.</li>
        ) : null}
      </ol>
    );
  } else {
    tabContent = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Né(e) le</div>
          <div className="text-sm text-foreground">{formatDate(patient.dateOfBirth)}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Téléphone</div>
          <div className="text-sm text-foreground">{patient.mobile ?? patient.phone ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Email</div>
          <div className="text-sm text-foreground">{patient.email ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Adresse</div>
          <div className="text-sm text-foreground">
            {[patient.addressLine1, patient.npa, patient.city].filter(Boolean).join(", ") || "—"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/patients" className="text-sm font-medium text-primary hover:underline">
        ← Retour à la liste
      </Link>

      <div className="mb-2 mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold text-foreground">
          {patient.firstName} {patient.lastName}
        </h1>
        <span className="font-mono text-xs text-muted-foreground">{patient.patientNumber}</span>
      </div>

      {alerts.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {alerts.map((alert) => (
            <span
              key={alert.id}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${ALERT_SEVERITY_CLASS[alert.severity] ?? "bg-muted"}`}
            >
              ⚠ {alert.label}
            </span>
          ))}
        </div>
      ) : null}

      <nav className="mb-6 flex gap-1 border-b border-border" aria-label="Sections de la fiche patient">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/patients/${id}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tabContent}
    </main>
  );
}
