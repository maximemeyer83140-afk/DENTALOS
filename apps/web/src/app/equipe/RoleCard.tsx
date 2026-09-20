"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";

import { updateRolePermissionsAction, type ActionState } from "./actions";
import { PermissionCheckboxes, type PermissionOption } from "./PermissionCheckboxes";

const initialState: ActionState = {};

export interface RoleCardData {
  id: string;
  name: string;
  permissionKeys: string[];
  memberCount: number;
}

export function RoleCard({ role, permissions }: { role: RoleCardData; permissions: PermissionOption[] }): ReactNode {
  const [editing, setEditing] = useState(false);
  const boundAction = updateRolePermissionsAction.bind(null, role.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-medium text-foreground">{role.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {role.permissionKeys.length} permission(s) · {role.memberCount} membre(s)
          </span>
        </div>
        <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
          {editing ? "Fermer" : "Modifier les permissions"}
        </button>
      </div>

      {editing ? (
        <form action={formAction} className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <PermissionCheckboxes permissions={permissions} checkedKeys={role.permissionKeys} idPrefix={`role-${role.id}`} />
          <div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "…" : "Enregistrer les permissions"}
            </button>
          </div>
          {state.error ? (
            <p role="alert" className="text-xs text-red-600">
              {state.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
