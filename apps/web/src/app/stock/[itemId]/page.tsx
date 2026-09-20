import Link from "next/link";
import type { ReactNode } from "react";

import { getInventoryItem, listLotsForItem, listMovementsForItem } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { INVENTORY_CATEGORY_LABEL, INVENTORY_MOVEMENT_TYPE_CLASS, INVENTORY_MOVEMENT_TYPE_LABEL } from "@/lib/inventory";
import { requirePermission } from "@/lib/rbac";

import { AdjustStockForm, ConsumeStockForm, ReceiveStockForm } from "../StockMovementForms";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function InventoryItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}): Promise<ReactNode> {
  const { itemId } = await params;
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.read");
  const [item, lots, movements] = await Promise.all([
    getInventoryItem(ctx, itemId),
    listLotsForItem(ctx, itemId),
    listMovementsForItem(ctx, itemId),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <AppNav current="stock" />
      <Link href="/stock" className="text-sm font-medium text-primary hover:underline">
        ← Stock
      </Link>

      <div className="mb-2 mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold text-foreground">{item.name}</h1>
        <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
      </div>
      <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{INVENTORY_CATEGORY_LABEL[item.category] ?? item.category}</span>
        <span>{item.supplierName ?? "Aucun fournisseur"}</span>
        <span>Prix d&apos;achat CHF {Number(item.costPrice).toFixed(2)}</span>
        {item.locationLabel ? <span>Emplacement {item.locationLabel}</span> : null}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={`rounded-md border p-4 ${item.isLowStock ? "border-amber-200 bg-amber-50" : "border-border"}`}>
          <div className="text-xs font-medium uppercase text-muted-foreground">Stock actuel</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-foreground">
            {item.currentStock} {item.unit}
          </div>
          {item.isLowStock ? <div className="mt-0.5 text-xs font-medium text-amber-700">Sous le seuil d&apos;alerte ({item.reorderThreshold})</div> : null}
        </div>
        <div className="rounded-md border border-border p-4">
          <div className="text-xs font-medium uppercase text-muted-foreground">Seuil d&apos;alerte</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-foreground">{item.reorderThreshold}</div>
        </div>
      </div>

      <div className="mb-8 flex flex-col gap-2">
        <ReceiveStockForm itemId={item.id} />
        <ConsumeStockForm itemId={item.id} />
        <AdjustStockForm itemId={item.id} />
      </div>

      <div className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Lots ({lots.length})</h2>
        <ul className="flex flex-col gap-2">
          {lots.map((lot) => (
            <li key={lot.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span className="text-foreground">{lot.lotNumber}</span>
              <span className="text-xs text-muted-foreground">
                {Number(lot.quantity)} {item.unit} reçus le {formatDate(lot.receivedAt)}
                {lot.expiresAt ? ` · péremption ${formatDate(lot.expiresAt)}` : ""}
              </span>
            </li>
          ))}
          {lots.length === 0 ? <li className="text-sm text-muted-foreground">Aucun lot réceptionné.</li> : null}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Historique des mouvements ({movements.length})</h2>
        <ul className="flex flex-col gap-2">
          {movements.map((movement) => (
            <li key={movement.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <div>
                <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${INVENTORY_MOVEMENT_TYPE_CLASS[movement.type] ?? "bg-muted"}`}>
                  {INVENTORY_MOVEMENT_TYPE_LABEL[movement.type] ?? movement.type}
                </span>
                <span className="font-mono text-foreground">
                  {Number(movement.quantity) > 0 ? "+" : ""}
                  {Number(movement.quantity)} {item.unit}
                </span>
                {movement.reason ? <span className="ml-2 text-xs text-muted-foreground">{movement.reason}</span> : null}
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(movement.createdAt)}</span>
            </li>
          ))}
          {movements.length === 0 ? <li className="text-sm text-muted-foreground">Aucun mouvement.</li> : null}
        </ul>
      </div>
    </main>
  );
}
