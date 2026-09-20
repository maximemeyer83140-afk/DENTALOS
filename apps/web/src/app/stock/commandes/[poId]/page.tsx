import Link from "next/link";
import type { ReactNode } from "react";

import { getPurchaseOrder } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { PURCHASE_ORDER_STATUS_CLASS, PURCHASE_ORDER_STATUS_LABEL } from "@/lib/inventory";
import { requirePermission } from "@/lib/rbac";

import { CancelPurchaseOrderButton, SendPurchaseOrderButton } from "../PurchaseOrderActions";
import { ReceiveItemsForm } from "../ReceiveItemsForm";

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}): Promise<ReactNode> {
  const { poId } = await params;
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.read");
  const po = await getPurchaseOrder(ctx, poId);

  const receivableLines = po.items
    .map((item) => ({
      purchaseOrderItemId: item.id,
      itemName: item.inventoryItem.name,
      unit: item.inventoryItem.unit,
      remaining: Number(item.quantityOrdered) - Number(item.quantityReceived),
    }))
    .filter((l) => l.remaining > 0);

  const canReceive = po.status === "sent" || po.status === "partially_received";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <AppNav current="stock" />
      <Link href="/stock/commandes" className="text-sm font-medium text-primary hover:underline">
        ← Bons de commande
      </Link>

      <div className="mb-2 mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold text-foreground">{po.orderNumber}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PURCHASE_ORDER_STATUS_CLASS[po.status] ?? "bg-muted"}`}>
          {PURCHASE_ORDER_STATUS_LABEL[po.status] ?? po.status}
        </span>
      </div>
      <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{po.supplier.name}</span>
        <span>Livraison attendue {formatDate(po.expectedAt)}</span>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {po.status === "draft" ? <SendPurchaseOrderButton poId={po.id} /> : null}
        {po.status !== "received" && po.status !== "cancelled" ? <CancelPurchaseOrderButton poId={po.id} /> : null}
      </div>

      <div className="mb-8 overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Article</th>
              <th className="px-3 py-2">Commandé</th>
              <th className="px-3 py-2">Reçu</th>
              <th className="px-3 py-2">Prix unitaire</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {po.items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-foreground">
                  {item.inventoryItem.name} <span className="text-xs text-muted-foreground">({item.inventoryItem.sku})</span>
                </td>
                <td className="px-3 py-2 text-foreground">
                  {Number(item.quantityOrdered)} {item.inventoryItem.unit}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {Number(item.quantityReceived)} {item.inventoryItem.unit}
                </td>
                <td className="px-3 py-2 font-mono text-foreground">CHF {Number(item.unitCost).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canReceive ? <ReceiveItemsForm poId={po.id} lines={receivableLines} /> : null}
    </main>
  );
}
