import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface ClinicDashboard {
  revenue: {
    /** Encaissé (Payment.amount, status completed) — pas le chiffre d'affaires facturé, ce que le
     * cabinet a réellement reçu. */
    thisMonth: number;
    yearToDate: number;
  };
  soinsThisMonth: {
    count: number;
    total: number;
  };
  quotes: {
    /** Sur les 90 derniers jours — un devis vieux de deux ans qui traîne en "sent" ne doit pas
     * diluer indéfiniment le taux d'acceptation courant. */
    sent: number;
    accepted: number;
    rejected: number;
    acceptanceRate: number | null;
  };
  unpaidInvoices: {
    count: number;
    total: number;
  };
  recallsOverdue: number;
  tasksOpen: number;
  appointments: {
    today: number;
    thisWeek: number;
  };
  newPatientsThisMonth: number;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Un seul tableau de bord clinique — chiffres réellement calculés depuis les tables existantes
 * (Payment, Treatment, Quote, Invoice, Recall, Task, Appointment, Patient), jamais une valeur
 * factice. Chaque nombre reste explicable : "l'encaissé de ce mois" n'est pas "le facturé de ce
 * mois", "le taux d'acceptation des devis" ne compte que les devis décidés sur les 90 derniers
 * jours pour rester un indicateur d'activité récente plutôt qu'une moyenne historique diluée.
 */
export async function getClinicDashboard(ctx: TenantContext): Promise<ClinicDashboard> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [
    paymentsThisMonth,
    paymentsYtd,
    soinsThisMonth,
    quotesLast90Days,
    unpaidInvoices,
    recallsOverdueCount,
    tasksOpenCount,
    appointmentsToday,
    appointmentsThisWeek,
    newPatientsThisMonth,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, status: "completed", paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, status: "completed", paidAt: { gte: yearStart } },
      _sum: { amount: true },
    }),
    prisma.treatment.findMany({
      where: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        status: "completed",
        performedAt: { gte: monthStart },
      },
      select: { unitPrice: true, quantity: true },
    }),
    prisma.quote.groupBy({
      by: ["status"],
      where: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, createdAt: { gte: ninetyDaysAgo } },
      _count: { _all: true },
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        status: { in: ["issued", "partially_paid", "overdue"] },
      },
      _count: { _all: true },
      _sum: { balance: true },
    }),
    prisma.recall.count({
      where: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        status: { in: ["to_contact", "contacted", "scheduled"] },
        dueDate: { lt: todayStart },
      },
    }),
    prisma.task.count({
      where: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, status: { in: ["open", "in_progress"] } },
    }),
    prisma.appointment.count({
      where: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        startAt: { gte: todayStart, lt: todayEnd },
        status: { not: "cancelled" },
      },
    }),
    prisma.appointment.count({
      where: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        startAt: { gte: weekStart, lt: weekEnd },
        status: { not: "cancelled" },
      },
    }),
    prisma.patient.count({
      where: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, createdAt: { gte: monthStart } },
    }),
  ]);

  const quoteCounts = Object.fromEntries(quotesLast90Days.map((g) => [g.status, g._count._all]));
  const sent = quoteCounts.sent ?? 0;
  const accepted = quoteCounts.accepted ?? 0;
  const rejected = quoteCounts.rejected ?? 0;
  const partiallyAccepted = quoteCounts.partially_accepted ?? 0;
  const decided = accepted + rejected + partiallyAccepted;

  return {
    revenue: {
      thisMonth: Number(paymentsThisMonth._sum.amount ?? 0),
      yearToDate: Number(paymentsYtd._sum.amount ?? 0),
    },
    soinsThisMonth: {
      count: soinsThisMonth.length,
      total: soinsThisMonth.reduce((sum, t) => sum + Number(t.unitPrice) * t.quantity, 0),
    },
    quotes: {
      sent,
      accepted,
      rejected,
      acceptanceRate: decided > 0 ? (accepted + partiallyAccepted) / decided : null,
    },
    unpaidInvoices: {
      count: unpaidInvoices._count._all,
      total: Number(unpaidInvoices._sum.balance ?? 0),
    },
    recallsOverdue: recallsOverdueCount,
    tasksOpen: tasksOpenCount,
    appointments: {
      today: appointmentsToday,
      thisWeek: appointmentsThisWeek,
    },
    newPatientsThisMonth,
  };
}
