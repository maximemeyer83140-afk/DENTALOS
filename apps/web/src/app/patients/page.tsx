import Link from "next/link";
import type { ReactNode } from "react";

import { listPatients } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-CH").format(date);
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<ReactNode> {
  const { q } = await searchParams;
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "patients.read");
  const patients = await listPatients(ctx, { search: q });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="patients" />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Patients</h1>
          <p className="text-sm text-muted-foreground">{patients.length} patient(s)</p>
        </div>
        <Link
          href="/patients/new"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Nouveau patient
        </Link>
      </div>

      <form className="mb-4" action="/patients">
        <label htmlFor="q" className="sr-only">
          Rechercher un patient
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Rechercher par nom ou numéro patient…"
          className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </form>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">N°</th>
              <th className="px-3 py-2">Né(e) le</th>
              <th className="px-3 py-2">Téléphone</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link href={`/patients/${patient.id}`} className="font-medium text-primary hover:underline">
                    {patient.firstName} {patient.lastName}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{patient.patientNumber}</td>
                <td className="px-3 py-2">{formatDate(patient.dateOfBirth)}</td>
                <td className="px-3 py-2">{patient.mobile ?? patient.phone ?? "—"}</td>
              </tr>
            ))}
            {patients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Aucun patient{q ? ` pour « ${q} »` : ""}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
