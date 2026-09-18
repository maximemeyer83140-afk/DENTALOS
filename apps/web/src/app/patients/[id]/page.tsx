import Link from "next/link";
import type { ReactNode } from "react";

import {
  getCurrentChart,
  getMedicalProfile,
  getPatient,
  getPatientTimeline,
  listActiveAlerts,
  listActiveTariffItems,
  listAppointmentsForPatient,
  listDocumentsForPatient,
  listInvoicesForPatient,
  listMedicalProfileRevisions,
  listNotesForPatient,
  listPaymentsForPatient,
  listPractitioners,
  listQuotesForPatient,
  listTreatmentPlansForPatient,
} from "@dentalos/database";
import type { AppointmentStatus, DentalConditionType } from "@dentalos/database";

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

/**
 * ÉTAPE 3 : la fiche patient devient le centre de toute l'information — huit onglets, chacun
 * une facette distincte du dossier (le "chart" d'origine couvrait à la fois l'odontogramme, les
 * notes, le plan de traitement et les devis dans un seul onglet ; ils sont désormais séparés pour
 * que chaque section reste lisible).
 */
const TABS = [
  { id: "resume", label: "Résumé" },
  { id: "anamnese", label: "Anamnèse" },
  { id: "clinique", label: "Clinique / Soins" },
  { id: "plan", label: "Plan de traitement" },
  { id: "devis", label: "Devis" },
  { id: "facturation", label: "Facturation" },
  { id: "documents", label: "Documents" },
  { id: "rdv", label: "Rendez-vous" },
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

// Mirrors AgendaClient.tsx's STATUS_LABEL so an appointment reads the same way in the calendar
// and in the patient's own "Rendez-vous" tab.
const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Planifié",
  confirmed: "Confirmé",
  arrived: "Arrivé",
  in_chair: "En fauteuil",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { timeStyle: "short" }).format(date);
}

function calculateAge(dateOfBirth: Date | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    now.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
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
  const tab = TABS.some((t) => t.id === rawTab) ? rawTab! : "resume";

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "patients.read");

  const patient = await getPatient(ctx, id);
  const alerts = await listActiveAlerts(ctx, id);
  const age = calculateAge(patient.dateOfBirth);

  let tabContent: ReactNode;
  if (tab === "anamnese") {
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
  } else if (tab === "clinique") {
    const [chart, notes, practitioners] = await Promise.all([
      getCurrentChart(ctx, id),
      listNotesForPatient(ctx, id),
      listPractitioners(ctx),
    ]);
    const conditions: Record<number, DentalConditionType> = {};
    for (const entry of chart?.entries ?? []) {
      conditions[entry.toothNumber] = entry.condition;
    }
    const practitionerOptions = practitioners.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }));

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
      </div>
    );
  } else if (tab === "plan") {
    const [practitioners, plans, tariffItems] = await Promise.all([
      listPractitioners(ctx),
      listTreatmentPlansForPatient(ctx, id),
      listActiveTariffItems(ctx),
    ]);
    const practitionerOptions = practitioners.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }));
    const tariffOptions: TariffItemOption[] = tariffItems.map((item) => ({
      id: item.id,
      code: item.code,
      description: item.description,
      category: item.category ?? "Autres",
      points: item.points != null ? Number(item.points) : null,
      pointsPrivateMin: item.pointsPrivateMin != null ? Number(item.pointsPrivateMin) : null,
      pointsPrivateMax: item.pointsPrivateMax != null ? Number(item.pointsPrivateMax) : null,
      computedPrice: item.computedPrice != null ? Number(item.computedPrice) : null,
    }));

    tabContent = (
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
    );
  } else if (tab === "devis") {
    const quotes = await listQuotesForPatient(ctx, id);
    tabContent = (
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Devis ({quotes.length})</h2>
        <ul className="flex flex-col gap-2">
          {quotes.map((quote) => (
            <li key={quote.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span className="font-mono">{quote.quoteNumber}</span>
              <span className="text-muted-foreground">{QUOTE_STATUS_LABEL[quote.status] ?? quote.status}</span>
              <span className="font-mono">CHF {quote.total.toString()}</span>
              {quote.status === "accepted" ? <InvoiceButton patientId={id} quoteId={quote.id} /> : null}
            </li>
          ))}
          {quotes.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              Aucun devis. Un devis se crée depuis une option du plan de traitement.
            </li>
          ) : null}
        </ul>
      </div>
    );
  } else if (tab === "facturation") {
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
  } else if (tab === "rdv") {
    const appointments = await listAppointmentsForPatient(ctx, id);
    tabContent = (
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Rendez-vous ({appointments.length})</h2>
        <ul className="flex flex-col gap-2">
          {appointments.map((appt) => (
            <li key={appt.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex flex-col">
                <span className="font-medium text-foreground">
                  {formatDate(appt.startAt)} · {formatTime(appt.startAt)}–{formatTime(appt.endAt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {appt.appointmentType?.name ?? "—"} · Dr {appt.practitioner.firstName} {appt.practitioner.lastName}
                  {appt.room ? ` · ${appt.room.name}` : ""}
                </span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {APPOINTMENT_STATUS_LABEL[appt.status]}
              </span>
            </li>
          ))}
          {appointments.length === 0 ? (
            <li className="text-sm text-muted-foreground">Aucun rendez-vous pour ce patient.</li>
          ) : null}
        </ul>
      </div>
    );
  } else {
    const [events, appointments, plans, invoices] = await Promise.all([
      getPatientTimeline(ctx, id),
      listAppointmentsForPatient(ctx, id),
      listTreatmentPlansForPatient(ctx, id),
      listInvoicesForPatient(ctx, id),
    ]);
    const now = new Date();
    const nextAppointment = appointments
      .filter((a) => a.startAt >= now && a.status !== "cancelled")
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];
    const activePlans = plans.filter((p) => p.status !== "completed" && p.status !== "cancelled").length;
    const unpaidInvoices = invoices.filter(
      (i) => i.status === "issued" || i.status === "partially_paid" || i.status === "overdue",
    );
    const recentEvents = events.slice(0, 8);

    tabContent = (
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">Adresse</div>
            <div className="text-sm text-foreground">
              {[patient.addressLine1, patient.npa, patient.city].filter(Boolean).join(", ") || "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">Langue</div>
            <div className="text-sm text-foreground">{patient.language ?? "—"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Prochain rendez-vous</div>
            <div className="text-sm text-foreground">
              {nextAppointment ? `${formatDate(nextAppointment.startAt)} · ${formatTime(nextAppointment.startAt)}` : "Aucun"}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Plans de traitement actifs</div>
            <div className="text-sm text-foreground">{activePlans}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Factures impayées</div>
            <div className="text-sm text-foreground">{unpaidInvoices.length}</div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Activité récente</h2>
          <ol className="flex flex-col gap-3">
            {recentEvents.map((event) => (
              <li key={`${event.type}-${event.entityId}`} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-wide">{event.type.replace("_", " ")}</span>
                  <span>{formatDateTime(event.date)}</span>
                </div>
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                {event.detail ? <p className="text-sm text-muted-foreground">{event.detail}</p> : null}
              </li>
            ))}
            {recentEvents.length === 0 ? (
              <li className="text-sm text-muted-foreground">Aucun événement pour l&apos;instant.</li>
            ) : null}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/patients" className="text-sm font-medium text-primary hover:underline">
        ← Retour à la liste
      </Link>

      {/* En-tête : toujours visible quel que soit l'onglet actif (ÉTAPE 3) — identité, contact,
          numéro patient et alertes médicales importantes en un coup d'œil. */}
      <div className="mb-2 mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          {patient.firstName} {patient.lastName}
        </h1>
        <span className="font-mono text-xs text-muted-foreground">{patient.patientNumber}</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          {formatDate(patient.dateOfBirth)}
          {age !== null ? ` (${age} ans)` : ""}
        </span>
        <span>{patient.mobile ?? patient.phone ?? "Téléphone —"}</span>
        <span>{patient.email ?? "Email —"}</span>
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

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-border" aria-label="Sections de la fiche patient">
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
