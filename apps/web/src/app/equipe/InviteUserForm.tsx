"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";

import { generateTemporaryPassword } from "@/lib/team";

import { createUserAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface RoleOption {
  id: string;
  name: string;
}

export function InviteUserForm({ roles }: { roles: RoleOption[] }): ReactNode {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [temporaryPassword, setTemporaryPassword] = useState(() => generateTemporaryPassword());

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
    setTemporaryPassword(generateTemporaryPassword());
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="invite-name" className="text-xs font-medium text-muted-foreground">
          Nom
        </label>
        <input
          id="invite-name"
          name="name"
          required
          placeholder="Prénom Nom"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="invite-email" className="text-xs font-medium text-muted-foreground">
          Email
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="invite-role" className="text-xs font-medium text-muted-foreground">
          Rôle
        </label>
        <select
          id="invite-role"
          name="roleId"
          required
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="invite-password" className="text-xs font-medium text-muted-foreground">
          Mot de passe provisoire
        </label>
        <div className="flex items-center gap-1">
          <input
            id="invite-password"
            name="temporaryPassword"
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => setTemporaryPassword(generateTemporaryPassword())}
            className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            ↻
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "…" : "Créer le collaborateur"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : (
        <p className="w-full text-xs text-muted-foreground">
          À communiquer au collaborateur en dehors de DentalOS — aucun email n&apos;est envoyé automatiquement.
        </p>
      )}
    </form>
  );
}
