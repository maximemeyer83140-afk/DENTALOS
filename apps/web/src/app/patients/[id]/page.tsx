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
  listCreditNotesForInvoice,
  listDocumentsForPatient,
  listInvoicesForPatient,
  listMedicalProfileRevisions,
  listNotesForPatient,
  listPaymentsForPatient,
  listPractitioners,
  listQuotesForPatient,
  listSoinsForPatient,
  listTreatmentPlansForPatient,
  SOIN_STATUS_LABEL,
} from "@dentalos/database";
import type { AppointmentStatus, DentalConditionType, SoinStatus } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

import { AlertForm } from "./AlertForm";
import { DocumentRow } from "./DocumentRow";
import { DocumentUpload } from "./DocumentUpload";
import { InvoiceRow } from "./InvoiceRow";
import { MedicalProfileForm } from "./MedicalProfileForm";
import { NoteForm } from "./NoteForm";
import { FinalizeNoteButton } from "./NoteActions";
import { Odontogram } from "./Odontogram";
import { PaymentForm } from "./PaymentForm";
import { QuoteButton } from "./QuoteButton";
import { QuoteRow } from "./QuoteRow";
import { MarkSoinCompletedButton } from "./SoinActions";
import { TreatmentPlanForm, type TariffItemOption } from "./TreatmentPlanForm";
import { UnbilledSoinsForm } from "./UnbilledSoinsForm";

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

// ÉTAPE 6 : statut explicite par soin/acte.
const SOIN_STATUS_CLASS: Record<SoinStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  done: "bg-blue-50 text-blue-700",
  to_invoice: "bg-amber-50 text-amber-700",
  invoiced: "bg-indigo-50 text-indigo-700",
  paid: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
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
          pathologies={(profile?.pathologies as Record<string, { present: boolean; notes?: string }>) ?? {}}
          medications={(profile?.medications as { name: string; dose?: string; frequency?: string; comment?: string }[]) ?? []}
          allergies={profile?.allergies ?? []}
          pastSurgeries={profile?.pastSurgeries ?? []}
          treatingPhysician={profile?.treatingPhysician ?? null}
          riskNotes={profile?.riskNotes ?? null}
          isPregnant={profile?.isPregnant ?? null}
          isSmoker={profile?.isSmoker ?? null}
          alcoholUse={profile?.alcoholUse ?? null}
          onAnticoagulants={profile?.onAnticoagulants ?? null}
          onAntiplatelets={profile?.onAntiplatelets ?? null}
          updatedAt={profile?.updatedAt ?? null}
          updatedBy={profile?.updatedBy ?? null}
          version={profile?.version ?? 1}
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
    const [chart, notes, practitioners, soins] = await Promise.all([
      getCurrentChart(ctx, id),
      listNotesForPatient(ctx, id),
      listPractitioners(ctx),
      listSoinsForPatient(ctx, id),
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

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Statut des soins ({soins.length})
          </h2>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Acte</th>
                  <th className="px-3 py-2">Dent</th>
                  <th className="px-3 py-2">Praticien</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Prix</th>
                  <th className="px-3 py-2">Réalisé le</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {soins.map((soin) => (
                  <tr key={soin.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{soin.description}</td>
                    <td className="px-3 py-2 text-muted-foreground">{soin.toothNumber ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{soin.practitionerName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{soin.tariffCode ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">
                      CHF {(soin.unitPrice * soin.quantity).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {soin.performedAt ? formatDate(soin.performedAt) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SOIN_STATUS_CLASS[soin.status]}`}>
                        {SOIN_STATUS_LABEL[soin.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {soin.status === "planned" ? <MarkSoinCompletedButton patientId={id} itemId={soin.id} /> : null}
                    </td>
                  </tr>
                ))}
                {soins.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Aucun soin planifié pour ce patient.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
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
            <QuoteRow
              key={quote.id}
              patientId={id}
              quote={{
                id: quote.id,
                quoteNumber: quote.quoteNumber,
                status: quote.status,
                createdAt: quote.createdAt,
                total: quote.total.toString(),
                items: quote.items.map((item) => ({
                  id: item.id,
                  description: item.description,
                  toothNumber: item.toothNumber,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice.toString(),
                  lineTotal: item.lineTotal.toString(),
                })),
              }}
            />
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
    const [invoices, payments, soins] = await Promise.all([
      listInvoicesForPatient(ctx, id),
      listPaymentsForPatient(ctx, id),
      listSoinsForPatient(ctx, id),
    ]);
    const creditNotesByInvoice = await Promise.all(
      invoices.map((invoice) => listCreditNotesForInvoice(ctx, invoice.id)),
    );
    const payableInvoices = invoices
      .filter((invoice) => invoice.status === "issued" || invoice.status === "partially_paid")
      .map((invoice) => ({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, balance: invoice.balance.toString() }));

    // ÉTAPE 8 : "Total facturé / Total payé / Reste dû" — les brouillons ne comptent pas encore
    // comme facturé (rien n'a été émis), une facture annulée non plus.
    const billedInvoices = invoices.filter((inv) => inv.status !== "draft" && inv.status !== "cancelled");
    const totalBilled = billedInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const totalPaid = billedInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
    const totalDue = billedInvoices.reduce((sum, inv) => sum + Number(inv.balance), 0);

    const unbilledSoins = soins
      .filter((soin) => soin.status === "to_invoice" && soin.treatmentId)
      .map((soin) => ({
        treatmentId: soin.treatmentId as string,
        description: soin.description,
        toothNumber: soin.toothNumber,
        performedAt: soin.performedAt,
        amount: soin.unitPrice * soin.quantity,
      }));

    tabContent = (
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Total facturé</div>
            <div className="font-mono text-lg text-foreground">CHF {totalBilled.toFixed(2)}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Total payé</div>
            <div className="font-mono text-lg text-foreground">CHF {totalPaid.toFixed(2)}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Reste dû</div>
            <div className="font-mono text-lg text-foreground">CHF {totalDue.toFixed(2)}</div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Soins réalisés non facturés ({unbilledSoins.length})
          </h2>
          <UnbilledSoinsForm patientId={id} soins={unbilledSoins} />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Factures ({invoices.length})</h2>
          <ul className="flex flex-col gap-2">
            {invoices.map((invoice, index) => (
              <InvoiceRow
                key={invoice.id}
                patientId={id}
                invoice={{
                  id: invoice.id,
                  invoiceNumber: invoice.invoiceNumber,
                  status: invoice.status,
                  createdAt: invoice.createdAt,
                  total: invoice.total.toString(),
                  balance: invoice.balance.toString(),
                  items: invoice.items.map((item) => ({
                    id: item.id,
                    description: item.description,
                    toothNumber: item.toothNumber,
                    quantity: item.quantity,
                    lineTotal: item.lineTotal.toString(),
                  })),
                  creditNotes: creditNotesByInvoice[index]!.map((cn) => ({
                    id: cn.id,
                    creditNoteNumber: cn.creditNoteNumber,
                    amount: cn.amount.toString(),
                    reason: cn.reason,
                    issueDate: cn.issueDate,
                  })),
                }}
              />
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
    const allDocuments = await listDocumentsForPatient(ctx, id, { includeArchived: true });
    const activeDocuments = allDocuments.filter((d) => !d.isArchived);
    const archivedDocuments = allDocuments.filter((d) => d.isArchived);
    tabContent = (
      <div className="flex flex-col gap-4">
        <DocumentUpload patientId={id} />
        <ul className="flex flex-col gap-2">
          {activeDocuments.map((doc) => (
            <DocumentRow key={doc.id} patientId={id} document={doc} />
          ))}
          {activeDocuments.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun document.</li>
          ) : null}
        </ul>
        {archivedDocuments.length > 0 ? (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Archivés ({archivedDocuments.length})</h2>
            <ul className="flex flex-col gap-2">
              {archivedDocuments.map((doc) => (
                <DocumentRow key={doc.id} patientId={id} document={doc} />
              ))}
            </ul>
          </div>
        ) : null}
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
    const [events, appointments, plans, invoices, soins, documents] = await Promise.all([
      getPatientTimeline(ctx, id),
      listAppointmentsForPatient(ctx, id),
      listTreatmentPlansForPatient(ctx, id),
      listInvoicesForPatient(ctx, id),
      listSoinsForPatient(ctx, id),
      listDocumentsForPatient(ctx, id),
    ]);
    const now = new Date();
    const nextAppointment = appointments
      .filter((a) => a.startAt >= now && a.status !== "cancelled")
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];
    const lastConsultation = appointments
      .filter((a) => a.startAt < now && a.status !== "cancelled" && a.status !== "no_show")
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())[0];
    const activePlans = plans.filter((p) => p.status !== "completed" && p.status !== "cancelled").length;
    const unpaidInvoices = invoices.filter(
      (i) => i.status === "issued" || i.status === "partially_paid" || i.status === "overdue",
    );
    const openInvoicesTotal = unpaidInvoices.reduce((sum, i) => sum + Number(i.balance), 0);
    // ÉTAPE 9 : "soins restant à réaliser" — tout ce qui n'a pas encore été effectué, prévu comme
    // pas encore facturé (les deux n'ont, par définition, jamais été réalisés).
    const remainingSoinsTotal = soins
      .filter((s) => s.status === "planned")
      .reduce((sum, s) => sum + s.unitPrice * s.quantity, 0);
    const recentEvents = events.slice(0, 8);
    const recentDocuments = documents.slice(0, 5);

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

        {alerts.length > 0 ? (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Alertes médicales ({alerts.length})</h2>
            <div className="flex flex-wrap gap-2">
              {alerts.map((alert) => (
                <span
                  key={alert.id}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${ALERT_SEVERITY_CLASS[alert.severity] ?? "bg-muted"}`}
                >
                  ⚠ {alert.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Prochain rendez-vous</div>
            <div className="text-sm text-foreground">
              {nextAppointment ? `${formatDate(nextAppointment.startAt)} · ${formatTime(nextAppointment.startAt)}` : "Aucun"}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Dernière consultation</div>
            <div className="text-sm text-foreground">
              {lastConsultation ? formatDate(lastConsultation.startAt) : "Aucune"}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Plans de traitement actifs</div>
            <div className="text-sm text-foreground">{activePlans}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Soins restant à réaliser</div>
            <div className="font-mono text-sm text-foreground">CHF {remainingSoinsTotal.toFixed(2)}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Factures ouvertes</div>
            <div className="font-mono text-sm text-foreground">CHF {openInvoicesTotal.toFixed(2)}</div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Documents récents</h2>
          <ul className="flex flex-col gap-1">
            {recentDocuments.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="text-foreground">{doc.fileName}</span>
                <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
              </li>
            ))}
            {recentDocuments.length === 0 ? (
              <li className="text-sm text-muted-foreground">Aucun document.</li>
            ) : null}
          </ul>
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
