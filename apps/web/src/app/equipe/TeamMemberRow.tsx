"use client";

import type { ReactNode } from "react";
import { useActionState, useTransition } from "react";

import { USER_STATUS_CLASS, USER_STATUS_LABEL } from "@/lib/team";

import { setUserStatusAction, updateUserRoleAction, type ActionState } from "./actions";
import type { RoleOption } from "./InviteUserForm";

const initialState: ActionState = {};

export interface TeamMemberRowData {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt: Date | null;
  roleId: string;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function TeamMemberRow({ member, roles }: { member: TeamMemberRowData; roles: RoleOption[] }): ReactNode {
  const boundRoleAction = updateUserRoleAction.bind(null, member.id);
  const [roleState, roleFormAction, rolePending] = useActionState(boundRoleAction, initialState);
  const [statusPending, startStatusTransition] = useTransition();

  const nextStatus = member.status === "suspended" ? "active" : "suspended";

  return (
    <tr>
      <td className="px-3 py-2">
        <div className="font-medium text-foreground">{member.name}</div>
        <div className="text-xs text-muted-foreground">{member.email}</div>
      </td>
      <td className="px-3 py-2">
        <form action={roleFormAction} className="flex items-center gap-1">
          <select
            name="roleId"
            defaultValue={member.roleId}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={rolePending}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {rolePending ? "…" : "OK"}
          </button>
        </form>
        {roleState.error ? <p className="mt-1 text-xs text-red-600">{roleState.error}</p> : null}
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${USER_STATUS_CLASS[member.status] ?? "bg-muted"}`}>
          {USER_STATUS_LABEL[member.status] ?? member.status}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Jamais connecté"}
      </td>
      <td className="px-3 py-2">
        {member.status === "active" || member.status === "suspended" ? (
          <button
            type="button"
            disabled={statusPending}
            onClick={() => startStatusTransition(() => setUserStatusAction(member.id, nextStatus))}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {statusPending ? "…" : nextStatus === "suspended" ? "Suspendre" : "Réactiver"}
          </button>
        ) : null}
      </td>
    </tr>
  );
}
