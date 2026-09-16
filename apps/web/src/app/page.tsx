import type { ReactNode } from "react";

export default function HomePage(): ReactNode {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        DentalOS — Phase 0
      </p>
      <h1 className="text-3xl font-semibold text-foreground">
        Fondations en cours de construction.
      </h1>
      <p className="text-muted-foreground">
        L&apos;architecture, le modèle de données et l&apos;outillage sont en place. Les modules
        fonctionnels (agenda, patients, facturation, ...) arrivent dans les phases suivantes — voir{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-sm">ROADMAP.md</code>.
      </p>
    </main>
  );
}
