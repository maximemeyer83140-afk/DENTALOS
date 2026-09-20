import Link from "next/link";
import type { ReactNode } from "react";

import { listInventoryItems, listSuppliers } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { INVENTORY_CATEGORY_LABEL } from "@/lib/inventory";
import { requirePermission } from "@/lib/rbac";

import { CreateItemForm } from "./CreateItemForm";
import { CreateSupplierForm } from "./CreateSupplierForm";

/**
 * ÉTAPE 13 : gestion du stock — jusqu'ici `Supplier`/`InventoryItem`/`InventoryLot`/
 * `InventoryMovement` existaient au schéma depuis la Phase 0 sans repository ni UI. Un cabinet
 * dentaire consomme un stock réel (gants, composites, anesthésiants, fraises...) et doit voir venir
 * une rupture avant qu'elle n'arrive — c'est tout l'intérêt du seuil d'alerte ci-dessous.
 */
export default async function StockPage(): Promise<ReactNode> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.read");
  const [items, suppliers] = await Promise.all([listInventoryItems(ctx), listSuppliers(ctx)]);
  const lowStockCount = items.filter((i) => i.isLowStock).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="stock" />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Stock</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} article(s){lowStockCount > 0 ? ` · ${lowStockCount} sous le seuil d'alerte` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/stock/commandes" className="text-sm font-medium text-primary hover:underline">
            Bons de commande →
          </Link>
          <CreateItemForm suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Article</th>
              <th className="px-3 py-2">Catégorie</th>
              <th className="px-3 py-2">Fournisseur</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Prix d&apos;achat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id} className={item.isLowStock ? "bg-amber-50/60" : undefined}>
                <td className="px-3 py-2">
                  <Link href={`/stock/${item.id}`} className="font-medium text-primary hover:underline">
                    {item.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{item.sku}</div>
                </td>
                <td className="px-3 py-2 text-sm text-foreground">{INVENTORY_CATEGORY_LABEL[item.category] ?? item.category}</td>
                <td className="px-3 py-2 text-sm text-foreground">{item.supplierName ?? "—"}</td>
                <td className={`px-3 py-2 text-sm ${item.isLowStock ? "font-semibold text-amber-700" : "text-foreground"}`}>
                  {item.currentStock} {item.unit}
                  {item.isLowStock ? " · seuil atteint" : ""}
                </td>
                <td className="px-3 py-2 font-mono text-sm text-foreground">CHF {Number(item.costPrice).toFixed(2)}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucun article de stock.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Fournisseurs ({suppliers.length})</h2>
        <div className="mb-3">
          <CreateSupplierForm />
        </div>
        <ul className="flex flex-col gap-2">
          {suppliers.map((supplier) => (
            <li key={supplier.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{supplier.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {[supplier.contactName, supplier.phone, supplier.email].filter(Boolean).join(" · ") || "—"}
              </span>
            </li>
          ))}
          {suppliers.length === 0 ? <li className="text-sm text-muted-foreground">Aucun fournisseur.</li> : null}
        </ul>
      </div>
    </main>
  );
}
