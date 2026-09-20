"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";

import { createRoleAction, type ActionState } from "./actions";
import { PermissionCheckboxes, type PermissionOption } from "./PermissionCheckboxes";

const initialState: ActionState = {};

export function CreateRoleForm({ permissions }: { permissions: PermissionOption[] }): ReactNode {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createRoleAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        + Nouveau rôle
      </button>
    );
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-grow flex-col gap-1">
          <label htmlFor="role-name" className="text-xs font-medium text-muted-foreground">
            Nom du rôle
          </label>
          <input
            id="role-name"
            name="name"
            required
            placeholder="ex. Assistante, Hygiéniste, Réceptionniste"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
          Annuler
        </button>
      </div>
      <PermissionCheckboxes permissions={permissions} checkedKeys={[]} idPrefix="new-role" />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "…" : "Créer le rôle"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
