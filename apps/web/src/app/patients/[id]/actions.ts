"use server";

import { revalidatePath } from "next/cache";

import {
  addAlert,
  computeTariffItemPrice,
  createCreditNote,
  createDocumentRecord,
  createInvoiceFromQuote,
  createInvoiceFromTreatments,
  createNote,
  createQuoteFromPlanOption,
  createRecall,
  createTreatmentPlan,
  finalizeNote,
  getTariffItem,
  logCommunication,
  recordPayment,
  recordToothCondition,
  updateDocument,
  updateMedicalProfile,
  updateQuoteStatus,
  updateRecallStatus,
  updateTreatmentPlanItemStatus,
  validateInvoice,
} from "@dentalos/database";
import type { DentalConditionType, QuoteStatus, TreatmentPlanItemInput } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { addAlertSchema, parseMedicalProfileFormData } from "@/lib/validation/medical-profile";
import { createNoteSchema, createTreatmentPlanSchema } from "@/lib/validation/clinical";
import { createCreditNoteSchema, recordPaymentSchema } from "@/lib/validation/billing";
import { MAX_DOCUMENT_SIZE_BYTES, updateDocumentSchema, uploadDocumentSchema } from "@/lib/validation/documents";
import { createRecallSchema, logCommunicationSchema, updateRecallStatusSchema } from "@/lib/validation/recalls";
import { getStorageProvider } from "@/lib/storage";

export interface ActionState {
  error?: string;
}

export async function addAlertAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addAlertSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await addAlert(ctx, patientId, parsed.data, ctx.userId);

  revalidatePath(`/patients/${patientId}`);
  return {};
}

export async function updateMedicalProfileAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseMedicalProfileFormData(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await updateMedicalProfile(ctx, patientId, parsed.data, ctx.userId);

  revalidatePath(`/patients/${patientId}`);
  return {};
}

/** Called imperatively from the odontogram (one click = one server round trip), not bound to a
 * form — see Odontogram.tsx. */
export async function recordToothConditionAction(
  patientId: string,
  toothNumber: number,
  condition: DentalConditionType,
): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await recordToothCondition(ctx, patientId, { toothNumber, condition }, ctx.userId);
  revalidatePath(`/patients/${patientId}`);
}

export async function createNoteAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createNoteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await createNote(ctx, patientId, parsed.data, ctx.userId);

  revalidatePath(`/patients/${patientId}`);
  return {};
}

export async function finalizeNoteAction(patientId: string, noteId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await finalizeNote(ctx, noteId);
  revalidatePath(`/patients/${patientId}`);
}

/**
 * Builds a treatment plan option from one or more tariff-catalog lines (e.g. anesthésie + digue +
 * composite in a single visit). The price is never taken from the client: each line only carries a
 * `tariffItemId`, and the server re-resolves the item's real description and price from the
 * catalog under the chosen billing regime (`computeTariffItemPrice`) before writing anything — the
 * same "server is the only authority on money" rule already applied to quotes/invoices (section
 * 79). `mode` picks what the built option represents: "quote" (Devis — a proposal, items start
 * "planned", can later become a Quote) or "treatment" (Traitement — acts performed today, items
 * start "completed").
 */
export async function createTreatmentPlanAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createTreatmentPlanSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");

  const items: TreatmentPlanItemInput[] = [];
  for (const line of parsed.data.lines) {
    const tariffItem = await getTariffItem(ctx, line.tariffItemId);
    let unitPrice: number;
    try {
      unitPrice = computeTariffItemPrice({
        item: tariffItem,
        regime: parsed.data.regime,
        pointValue: parsed.data.pointValue,
        privatePoints: line.privatePoints,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "prix non calculable";
      return { error: `${tariffItem.code} — ${tariffItem.description} : ${message}` };
    }
    items.push({
      description: `${tariffItem.code} — ${tariffItem.description}`,
      toothNumber: line.toothNumber,
      quantity: line.quantity,
      unitPrice,
      tariffItemId: tariffItem.id,
      status: parsed.data.mode === "treatment" ? "completed" : undefined,
    });
  }

  const defaultLabel =
    parsed.data.mode === "treatment"
      ? `Séance du ${new Date().toLocaleDateString("fr-CH")}`
      : "Option A";

  await createTreatmentPlan(
    ctx,
    patientId,
    { practitionerId: parsed.data.practitionerId, optionLabel: parsed.data.optionLabel ?? defaultLabel, items },
    ctx.userId,
  );

  revalidatePath(`/patients/${patientId}`);
  return {};
}

/** ÉTAPE 6 : marque un acte planifié comme réalisé — crée son `Treatment` dans le même mouvement
 * (voir updateTreatmentPlanItemStatus), donc le statut affiché passe aussitôt de « Prévu » à
 * « À facturer ». */
export async function markTreatmentPlanItemCompletedAction(patientId: string, itemId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await updateTreatmentPlanItemStatus(ctx, itemId, "completed", ctx.userId);
  revalidatePath(`/patients/${patientId}`);
}

export async function createQuoteAction(patientId: string, treatmentPlanOptionId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await createQuoteFromPlanOption(ctx, treatmentPlanOptionId, undefined, ctx.userId);
  revalidatePath(`/patients/${patientId}`);
}

export async function createInvoiceAction(patientId: string, quoteId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "invoices.create");
  await createInvoiceFromQuote(ctx, quoteId, undefined, ctx.userId);
  revalidatePath(`/patients/${patientId}`);
}

/** ÉTAPE 7 : envoyer / accepter / partiellement accepter / refuser un devis — voir
 * updateQuoteStatus pour la répercussion sur les lignes de plan de traitement sous-jacentes. */
export async function updateQuoteStatusAction(patientId: string, quoteId: string, status: QuoteStatus): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await updateQuoteStatus(ctx, quoteId, status);
  revalidatePath(`/patients/${patientId}`);
}

export async function validateInvoiceAction(patientId: string, invoiceId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "invoices.validate");
  await validateInvoice(ctx, invoiceId, ctx.userId);
  revalidatePath(`/patients/${patientId}`);
}

export async function recordPaymentAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = recordPaymentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "payments.create");
  await recordPayment(
    ctx,
    {
      patientId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference,
      allocations: [{ invoiceId: parsed.data.invoiceId, amount: parsed.data.amount }],
    },
    ctx.userId,
  );

  revalidatePath(`/patients/${patientId}`);
  return {};
}

/**
 * ÉTAPE 5 : upload réel — le fichier est écrit sur disque via `StorageProvider` avant que la
 * moindre ligne n'atteigne la base (`createDocumentRecord` ne fait qu'enregistrer les métadonnées,
 * jamais le contenu), donc un enregistrement en base ne peut jamais pointer vers des octets qui
 * n'ont pas été écrits.
 */
export async function uploadDocumentAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Sélectionne un fichier." };
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { error: `Fichier trop volumineux (max ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)} Mo).` };
  }

  const parsed = uploadDocumentSchema.safeParse({
    category: formData.get("category"),
    comment: formData.get("comment"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadResult = await getStorageProvider().upload({
    buffer,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    organizationId: ctx.organizationId,
  });

  await createDocumentRecord(
    ctx,
    {
      patientId,
      category: parsed.data.category,
      fileName: file.name,
      storageKey: uploadResult.storageKey,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: uploadResult.sizeBytes,
      contentHash: uploadResult.contentHash,
      comment: parsed.data.comment,
    },
    ctx.userId,
  );

  revalidatePath(`/patients/${patientId}`);
  return {};
}

/** Covers "renommer" et "classer" (ÉTAPE 5) — un petit formulaire par ligne de document. */
export async function updateDocumentAction(
  patientId: string,
  documentId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateDocumentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await updateDocument(ctx, documentId, parsed.data);

  revalidatePath(`/patients/${patientId}`);
  return {};
}

/** "Archiver" / "désarchiver" (ÉTAPE 5) — un bouton en un clic, pas un formulaire. */
export async function setDocumentArchivedAction(
  patientId: string,
  documentId: string,
  isArchived: boolean,
): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await updateDocument(ctx, documentId, { isArchived });
  revalidatePath(`/patients/${patientId}`);
}

/** ÉTAPE 8 : facture directement une sélection de soins réalisés qui ne sont jamais passés par un
 * devis — la case à cocher de chaque ligne "à facturer" du tableau des soins pose son
 * `treatmentId` dans ce même formulaire. */
export async function createInvoiceFromTreatmentsAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const treatmentIds = formData.getAll("treatmentId").map(String).filter(Boolean);
  if (treatmentIds.length === 0) return { error: "Sélectionne au moins un soin à facturer." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "invoices.create");
  await createInvoiceFromTreatments(ctx, patientId, treatmentIds, undefined, ctx.userId);

  revalidatePath(`/patients/${patientId}`);
  return {};
}

/** ÉTAPE 8 : un avoir — jamais une modification directe d'une facture déjà émise. */
export async function createCreditNoteAction(
  patientId: string,
  invoiceId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createCreditNoteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "invoices.validate");
  await createCreditNote(ctx, invoiceId, parsed.data.amount, parsed.data.reason, ctx.userId);

  revalidatePath(`/patients/${patientId}`);
  return {};
}

/** ÉTAPE 10 : planifie un rappel de contrôle depuis la fiche patient — le même rappel apparaît
 * ensuite dans le worklist clinique (/rappels). */
export async function createRecallAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createRecallSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "recalls.write");
  await createRecall(ctx, {
    patientId,
    dueDate: new Date(parsed.data.dueDate),
    reason: parsed.data.reason,
    notes: parsed.data.notes,
  });

  revalidatePath(`/patients/${patientId}`);
  return {};
}

/** Fait avancer le statut d'un rappel depuis l'onglet Suivi de la fiche patient. */
export async function updateRecallStatusFromPatientAction(
  patientId: string,
  recallId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateRecallStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "recalls.write");
  await updateRecallStatus(ctx, recallId, parsed.data.status, parsed.data.notes);

  revalidatePath(`/patients/${patientId}`);
  return {};
}

/** ÉTAPE 10 : journal manuel des communications — DentalOS n'envoie pas encore le SMS/email
 * lui-même (voir PHASE_6.md), ceci enregistre juste qu'un contact a eu lieu. */
export async function logCommunicationAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = logCommunicationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "communications.write");
  await logCommunication(
    ctx,
    { patientId, channel: parsed.data.channel, subject: parsed.data.subject, content: parsed.data.content },
    ctx.userId,
  );

  revalidatePath(`/patients/${patientId}`);
  return {};
}
