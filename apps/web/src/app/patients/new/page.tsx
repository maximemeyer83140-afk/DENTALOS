"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

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

const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "de", label: "Allemand" },
  { value: "it", label: "Italien" },
  { value: "en", label: "Anglais" },
];

const SEX_OPTIONS = [
  { value: "", label: "— Non précisé —" },
  { value: "F", label: "Féminin" },
  { value: "M", label: "Masculin" },
  { value: "autre", label: "Autre" },
];

export default function NewPatientPage(): ReactNode {
  const [state, formAction, pending] = useActionState(createPatientAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const confirmDuplicateRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function createAnyway(): void {
    if (confirmDuplicateRef.current) confirmDuplicateRef.current.value = "true";
    formRef.current?.requestSubmit();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/patients" className="text-sm font-medium text-primary hover:underline">
        ← Retour à la liste
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold text-foreground">Nouveau patient</h1>

      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <input ref={confirmDuplicateRef} type="hidden" name="confirmDuplicate" value="" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="title" label="Titre" error={fieldErrors.title} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sex" className="text-sm font-medium text-foreground">
              Sexe
            </label>
            <select
              id="sex"
              name="sex"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {SEX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="firstName" label="Prénom *" error={fieldErrors.firstName} />
          <Field id="lastName" label="Nom *" error={fieldErrors.lastName} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="dateOfBirth" label="Date de naissance" type="date" error={fieldErrors.dateOfBirth} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="language" className="text-sm font-medium text-foreground">
              Langue
            </label>
            <select
              id="language"
              name="language"
              defaultValue="fr"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="phone" label="Téléphone" type="tel" error={fieldErrors.phone} />
          <Field id="mobile" label="Mobile" type="tel" error={fieldErrors.mobile} />
        </div>
        <Field id="email" label="Email" type="email" error={fieldErrors.email} />
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

        {state.duplicates && state.duplicates.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4" role="alert">
            <p className="mb-2 text-sm font-semibold text-amber-900">
              ⚠ {state.duplicates.length > 1 ? "Des patients similaires existent déjà" : "Un patient similaire existe déjà"}
            </p>
            <ul className="mb-3 flex flex-col gap-2">
              {state.duplicates.map((d) => (
                <li key={d.id} className="rounded-md bg-white px-3 py-2 text-sm">
                  <Link href={`/patients/${d.id}`} target="_blank" className="font-medium text-primary hover:underline">
                    {d.name}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{d.patientNumber}</span>
                  <p className="text-xs text-amber-800">{d.reasons.join(", ")}</p>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={createAnyway}
                disabled={pending}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                Créer quand même
              </button>
              <span className="self-center text-xs text-amber-800">ou modifie les champs ci-dessus et resoumets.</span>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="mt-2 self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Vérification…" : "Créer le patient"}
          </button>
        )}
      </form>
    </main>
  );
}
