import type { ReactNode } from "react";

import { auth, signOut } from "@/lib/auth";

export default async function HomePage(): Promise<ReactNode> {
  const session = await auth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        DentalOS — Phase 1
      </p>
      <h1 className="text-3xl font-semibold text-foreground">
        Bonjour {session?.user.name ?? "—"}.
      </h1>
      <p className="text-muted-foreground">
        Connecté avec {session?.user.clinics.length ?? 0} accès clinique(s). Les écrans métier
        (agenda, patients, facturation, ...) arrivent dans les phases suivantes — voir{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-sm">ROADMAP.md</code>.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="text-sm font-medium text-primary underline">
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
