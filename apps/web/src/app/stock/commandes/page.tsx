import Link from "next/link";
import type { ReactNode } from "react";

import { listInventoryItems, listPurchaseOrders, listSuppliers } from "@dentalos/database";
import type { PurchaseOrderStatus } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { PURCHASE_ORDER_STATUS_CLASS, PURCHASE_ORDER_STATUS_LABEL } from "@/lib/inventory";
import { requirePermission } from "@/lib/rbac";

import { CreatePurchaseOrderForm } from "./CreatePurchaseOrderForm";

const FILTERS = [
  { id: "open", label: "En cours", statuses: ["draft", "sent", "partially_received"] as PurchaseOrderStatus[] },
  { id: "all", label: "Toutes", statuses: undefined },
] as const;

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

/**
 * ÉTAPE 14 : bons de commande fournisseur — complète le module Stock (Phase 9) avec le workflow
 * "commander → attendre → réceptionner", au lieu de réceptionner du stock sans jamais avoir tracé
 * ce qui avait été commandé (thème DentaGest : suivi des commandes fournisseur).
 */
export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}): Promise<ReactNode> {
  const { filter: rawFilter } = await searchParams;
  const filter = FILTERS.find((f) => f.id === rawFilter) ?? FILTERS[0];

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.read");
  const [orders, suppliers, items] = await Promise.all([
    listPurchaseOrders(ctx, { statuses: filter.statuses }),
    listSuppliers(ctx),
    listInventoryItems(ctx),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="stock" />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Bons de commande</h1>
          <p className="text-sm text-muted-foreground">{orders.length} commande(s)</p>
        </div>
        <Link href="/stock" className="text-sm font-medium text-primary hover:underline">
          ← Stock
        </Link>
      </div>

      <div className="mb-4">
        <CreatePurchaseOrderForm
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          items={items.map((i) => ({ id: i.id, name: i.name, sku: i.sku, unit: i.unit }))}
        />
      </div>

      <nav className="mb-4 flex gap-1 border-b border-border" aria-label="Filtres des commandes">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/stock/commandes?filter=${f.id}`}
            aria-current={filter.id === f.id ? "page" : undefined}
            className={`px-3 py-2 text-sm font-medium ${
              filter.id === f.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">N°</th>
              <th className="px-3 py-2">Fournisseur</th>
              <th className="px-3 py-2">Lignes</th>
              <th className="px-3 py-2">Livraison attendue</th>
              <th className="px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((po) => (
              <tr key={po.id}>
                <td className="px-3 py-2">
                  <Link href={`/stock/commandes/${po.id}`} className="font-medium text-primary hover:underline">
                    {po.orderNumber}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm text-foreground">{po.supplier.name}</td>
                <td className="px-3 py-2 text-sm text-foreground">{po.items.length}</td>
                <td className="px-3 py-2 text-sm text-foreground">{formatDate(po.expectedAt)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PURCHASE_ORDER_STATUS_CLASS[po.status] ?? "bg-muted"}`}>
                    {PURCHASE_ORDER_STATUS_LABEL[po.status] ?? po.status}
                  </span>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucun bon de commande.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
