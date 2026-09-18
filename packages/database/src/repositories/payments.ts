import type { Payment, PaymentMethod } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import { calculateBalance } from "../services/invoice-calculator";
import type { TenantContext } from "../tenant-context";

export interface PaymentAllocationInput {
  invoiceId: string;
  amount: number;
}

export interface RecordPaymentInput {
  patientId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | undefined;
  allocations: PaymentAllocationInput[];
}

/**
 * Records a payment and its allocation across one or more invoices in a single transaction,
 * keeping `Invoice.amountPaid`/`balance`/`status` in lockstep with the `PaymentAllocation` rows
 * that are their source of truth (schema comment on PaymentAllocation) — never an isolated
 * `UPDATE` that could drift out of sync with a concurrent allocation.
 */
export async function recordPayment(
  ctx: TenantContext,
  input: RecordPaymentInput,
  createdBy: string,
): Promise<Payment> {
  const allocatedTotal = input.allocations.reduce((sum, a) => sum + a.amount, 0);
  if (Math.round(allocatedTotal * 100) !== Math.round(input.amount * 100)) {
    throw new Error("Payment allocations must add up to exactly the payment amount");
  }
  if (input.allocations.length === 0) {
    throw new Error("A payment must be allocated to at least one invoice");
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        patientId: input.patientId,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        createdBy,
      },
    });

    for (const allocation of input.allocations) {
      const invoice = await tx.invoice.findFirst({
        where: { id: allocation.invoiceId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
      });
      if (!invoice) throw new NotFoundError(`Invoice ${allocation.invoiceId} not found`);
      if (allocation.amount > Number(invoice.balance) + 0.001) {
        throw new Error(
          `Allocation of ${allocation.amount} exceeds invoice ${invoice.invoiceNumber}'s balance of ${invoice.balance}`,
        );
      }

      await tx.paymentAllocation.create({
        data: { paymentId: payment.id, invoiceId: invoice.id, amount: allocation.amount },
      });

      const newAmountPaid = Number(invoice.amountPaid) + allocation.amount;
      const newBalance = calculateBalance(Number(invoice.total), newAmountPaid);

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: newBalance <= 0 ? "paid" : "partially_paid",
        },
      });
    }

    return payment;
  });
}

export async function listPaymentsForPatient(ctx: TenantContext, patientId: string): Promise<Payment[]> {
  return prisma.payment.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { paidAt: "desc" },
  });
}
