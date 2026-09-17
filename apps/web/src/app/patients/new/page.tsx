"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState } from "react";

import { createPatientAction, type CreatePatientFormState } from "./actions";

const initialState: CreatePatientFormState = {};

function Field({
  id,
  label,
  type = "text",
  error,
}: {
  id: string;
  label: string;
  type?: string;
  error?: string;
}): ReactNode {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function NewPatientPage(): ReactNode {
  const [state, formAction, pending] = useActionState(createPatientAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/patients" className="text-sm font-medium text-primary hover:underline">
        ← Retour à la liste
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold text-foreground">Nouveau patient</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="title" label="Titre" error={fieldErrors.title} />
          <Field id="sex" label="Sexe" error={fieldErrors.sex} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="firstName" label="Prénom *" error={fieldErrors.firstName} />
          <Field id="lastName" label="Nom *" error={fieldErrors.lastName} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="dateOfBirth" label="Date de naissance" type="date" error={fieldErrors.dateOfBirth} />
          <Field id="email" label="Email" type="email" error={fieldErrors.email} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="phone" label="Téléphone" type="tel" error={fieldErrors.phone} />
          <Field id="mobile" label="Mobile" type="tel" error={fieldErrors.mobile} />
        </div>
        <Field id="addressLine1" label="Adresse" error={fieldErrors.addressLine1} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field id="npa" label="NPA" error={fieldErrors.npa} />
          <Field id="city" label="Ville" error={fieldErrors.city} />
          <Field id="canton" label="Canton" error={fieldErrors.canton} />
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer le patient"}
        </button>
      </form>
    </main>
  );
}
