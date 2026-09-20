import Link from "next/link";
import type { ReactNode } from "react";

import { auth } from "@/lib/auth";

const LINKS = [
  { id: "agenda", href: "/agenda", label: "Agenda" },
  { id: "patients", href: "/patients", label: "Patients" },
  { id: "rappels", href: "/rappels", label: "Rappels" },
  { id: "taches", href: "/taches", label: "Tâches" },
  { id: "statistiques", href: "/statistiques", label: "Statistiques" },
  { id: "stock", href: "/stock", label: "Stock", requires: "inventory.read" },
  { id: "equipe", href: "/equipe", label: "Équipe", requires: "users.manage" },
] as const;

/**
 * Minimal cross-module navigation — until this session, Agenda / Patients / Rappels were three
 * disconnected route trees with only a single "← Retour" link back to /patients. Rendered inside
 * each top-level page rather than the root layout so the login page never shows it. "Équipe" is
 * hidden for anyone without `users.manage` on their first clinic — no point advertising a page
 * `requirePermission` will refuse anyway.
 */
export async function AppNav({ current }: { current: (typeof LINKS)[number]["id"] }): Promise<ReactNode> {
  const session = await auth();
  if (!session?.user) return null;
  const permissions = session.user.clinics[0]?.permissions ?? [];
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
    </nav>
  );
}
