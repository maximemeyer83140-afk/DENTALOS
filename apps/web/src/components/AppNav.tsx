import Link from "next/link";
import type { ReactNode } from "react";

import { auth } from "@/lib/auth";
import { getDefaultClinicId } from "@/lib/clinic-context";

import { ClinicSwitcher } from "./ClinicSwitcher";

const LINKS = [
  { id: "agenda", href: "/agenda", label: "Agenda" },
  { id: "patients", href: "/patients", label: "Patients" },
  { id: "rappels", href: "/rappels", label: "Rappels" },
  { id: "liste-attente", href: "/liste-attente", label: "Liste d'attente", requires: "agenda.read" },
  { id: "taches", href: "/taches", label: "Tâches" },
  { id: "statistiques", href: "/statistiques", label: "Statistiques" },
  { id: "stock", href: "/stock", label: "Stock", requires: "inventory.read" },
  { id: "laboratoire", href: "/laboratoire", label: "Laboratoire", requires: "laboratory.read" },
  { id: "finances", href: "/finances", label: "Finances", requires: "expenses.read" },
  { id: "remuneration", href: "/remuneration", label: "Rémunération", requires: "compensation.read" },
  { id: "equipe", href: "/equipe", label: "Équipe", requires: "users.manage" },
] as const;

/**
 * Minimal cross-module navigation — until this session, Agenda / Patients / Rappels were three
 * disconnected route trees with only a single "← Retour" link back to /patients. Rendered inside
 * each top-level page rather than the root layout so the login page never shows it. "Équipe" is
 * hidden for anyone without `users.manage` on the *active* clinic — no point advertising a page
 * `requirePermission` will refuse anyway. ÉTAPE 15 adds `ClinicSwitcher`: permissions (and so
 * which links show) are read from the clinic the user actually has active, not always their
 * first one.
 */
export async function AppNav({ current }: { current: (typeof LINKS)[number]["id"] }): Promise<ReactNode> {
  const session = await auth();
  if (!session?.user) return null;
  const activeClinicId = await getDefaultClinicId();
  const activeClinic = session.user.clinics.find((c) => c.clinicId === activeClinicId);
  const permissions = activeClinic?.permissions ?? [];
  const links = LINKS.filter((link) => !("requires" in link) || permissions.includes(link.requires));

  return (
    <nav className="mb-6 flex items-center gap-1 border-b border-border pb-3" aria-label="Navigation principale">
      <span className="mr-3 text-sm font-semibold text-foreground">DentalOS</span>
      {links.map((link) => (
        <Link
          key={link.id}
          href={link.href}
          aria-current={current === link.id ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            current === link.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {link.label}
        </Link>
      ))}
      <span className="flex-grow" />
      <ClinicSwitcher clinics={session.user.clinics.map((c) => ({ clinicId: c.clinicId, clinicName: c.clinicName }))} activeClinicId={activeClinicId} />
    </nav>
  );
}
