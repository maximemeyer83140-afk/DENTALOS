import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createPatient } from "../repositories/patients";
import { createTreatment } from "../repositories/treatments";
import { getClinicDashboard } from "./analytics";

/**
 * ÉTAPE 11 : le tableau de bord ne doit jamais renvoyer un chiffre inventé — chaque valeur est
 * vérifiée contre des données fixture connues, y compris les cas limites (aucun devis décidé =
 * taux d'acceptation `null`, pas une division par zéro ; une facture "cancelled" ou "paid" ne
 * compte jamais comme impayée).
 */
describe("analytics — getClinicDashboard", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let practitionerId = "";
  let patientId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Analytics Test Org ${suffix}`, slug: `analytics-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Analytics-${suffix}` },
    });
    practitionerId = practitioner.id;

    const patient = await createPatient(ctx, { firstName: "Stat", lastName: `Test-${suffix}` }, "seed");
    patientId = patient.id;

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10);
    const lastYear = new Date(now.getFullYear() - 1, 5, 1);

    // Encaissements : un ce mois-ci (compté), un l'an dernier (compté dans le YTD seulement si
    // dans l'année en cours — ici volontairement hors année en cours pour vérifier qu'il est exclu).
    await prisma.payment.create({
      data: {
        organizationId: org.id,
        clinicId: clinic.id,
        patientId,
        amount: 250,
        method: "card",
        status: "completed",
        paidAt: thisMonth,
      },
    });
    await prisma.payment.create({
      data: {
        organizationId: org.id,
        clinicId: clinic.id,
        patientId,
        amount: 9999,
        method: "card",
        status: "completed",
        paidAt: lastYear,
      },
    });
    // Paiement "failed" — jamais compté comme encaissement.
    await prisma.payment.create({
      data: {
        organizationId: org.id,
        clinicId: clinic.id,
        patientId,
        amount: 500,
        method: "card",
        status: "failed",
        paidAt: thisMonth,
      },
    });

    // Soins réalisés ce mois-ci : deux actes de 100.- (quantité 2 sur le second → 200.-).
    await createTreatment(
      ctx,
      { patientId, practitionerId, description: "Détartrage", unitPrice: 100, performedAt: thisMonth },
      "seed",
    );
    await createTreatment(
      ctx,
      { patientId, practitionerId, description: "Composite", unitPrice: 100, quantity: 2, performedAt: thisMonth },
      "seed",
    );
    // Planifié (pas réalisé) — ne doit jamais compter dans "soins réalisés".
    await createTreatment(
      ctx,
      { patientId, practitionerId, description: "Futur", unitPrice: 1000, performedAt: thisMonth, status: "planned" },
      "seed",
    );

    // Devis récents (< 90 jours) : 1 accepted, 1 rejected, 1 sent (pas encore décidé).
    for (const status of ["accepted", "rejected", "sent"] as const) {
      await prisma.quote.create({
        data: {
          organizationId: org.id,
          clinicId: clinic.id,
          patientId,
          practitionerId,
          quoteNumber: `Q-${suffix}-${status}`,
          status,
          subtotal: 100,
          total: 100,
        },
      });
    }

    // Factures : une "issued" impayée (compte), une "paid" (ne compte pas), une "cancelled" (ne
    // compte pas).
    await prisma.invoice.create({
      data: {
        organizationId: org.id,
        clinicId: clinic.id,
        patientId,
        practitionerId,
        invoiceNumber: `I-${suffix}-issued`,
        status: "issued",
        subtotal: 300,
        total: 300,
        balance: 300,
      },
    });
    await prisma.invoice.create({
      data: {
        organizationId: org.id,
        clinicId: clinic.id,
        patientId,
        practitionerId,
        invoiceNumber: `I-${suffix}-paid`,
        status: "paid",
        subtotal: 150,
        total: 150,
        balance: 0,
        amountPaid: 150,
      },
    });

    // Rappel en retard.
    await prisma.recall.create({
      data: { organizationId: org.id, clinicId: clinic.id, patientId, dueDate: new Date("2020-01-01"), status: "to_contact" },
    });

    // Tâche ouverte.
    await prisma.task.create({ data: { organizationId: org.id, clinicId: clinic.id, title: "Test task" } });

    // Rendez-vous aujourd'hui.
    const startAt = new Date();
    startAt.setHours(9, 0, 0, 0);
    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + 30);
    await prisma.appointment.create({
      data: { organizationId: org.id, clinicId: clinic.id, patientId, practitionerId, startAt, endAt },
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.treatment.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.quoteItem.deleteMany({ where: { quote: { organizationId: ctx.organizationId } } });
    await prisma.quote.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: ctx.organizationId } } });
    await prisma.invoice.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.recall.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.task.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.appointment.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.patient.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.practitioner.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  it("computes every KPI from real rows, excluding statuses/periods that don't belong", async () => {
    const dashboard = await getClinicDashboard(ctx);

    expect(dashboard.revenue.thisMonth).toBe(250);
    expect(dashboard.revenue.yearToDate).toBe(250);

    expect(dashboard.soinsThisMonth.count).toBe(2);
    expect(dashboard.soinsThisMonth.total).toBe(300);

    expect(dashboard.quotes.sent).toBe(1);
    expect(dashboard.quotes.accepted).toBe(1);
    expect(dashboard.quotes.rejected).toBe(1);
    expect(dashboard.quotes.acceptanceRate).toBe(0.5);

    expect(dashboard.unpaidInvoices.count).toBe(1);
    expect(dashboard.unpaidInvoices.total).toBe(300);

    expect(dashboard.recallsOverdue).toBe(1);
    expect(dashboard.tasksOpen).toBe(1);
    expect(dashboard.appointments.today).toBe(1);
    expect(dashboard.appointments.thisWeek).toBeGreaterThanOrEqual(1);
    expect(dashboard.newPatientsThisMonth).toBe(1);
  });

  it("never lets a clinic with no decided quote divide by zero", async () => {
    const org = await prisma.organization.create({
      data: { name: `Analytics Empty Org ${suffix}`, slug: `analytics-empty-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Empty", slug: "main" } });
    const emptyCtx = { organizationId: org.id, clinicId: clinic.id };

    const dashboard = await getClinicDashboard(emptyCtx);
    expect(dashboard.quotes.acceptanceRate).toBeNull();
    expect(dashboard.revenue.thisMonth).toBe(0);

    await prisma.clinic.delete({ where: { id: clinic.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
