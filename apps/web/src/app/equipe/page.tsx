import type { ReactNode } from "react";

import { listRoles, listTeamMembers, PERMISSIONS } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

import { CreateRoleForm } from "./CreateRoleForm";
import { InviteUserForm } from "./InviteUserForm";
import { RoleCard } from "./RoleCard";
import { TeamMemberRow } from "./TeamMemberRow";

/**
 * ÉTAPE 12 : gestion d'équipe et des rôles — jusqu'ici le RBAC (permissions par rôle, accès par
 * clinique) n'existait que côté serveur, alimenté uniquement par le seed de développement. Un
 * cabinet réel a plusieurs collaborateurs à des postes différents (assistante, hygiéniste,
 * réceptionniste) : il faut pouvoir les créer et ajuster leurs droits sans toucher à la base de
 * données (thème DentaGest : "droits d'accès fins avec traçabilité").
 */
export default async function TeamPage(): Promise<ReactNode> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "users.manage");
  const [roles, members] = await Promise.all([listRoles(ctx), listTeamMembers(ctx)]);

  const memberCountByRole = new Map<string, number>();
  for (const member of members) {
    memberCountByRole.set(member.roleId, (memberCountByRole.get(member.roleId) ?? 0) + 1);
  }
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="equipe" />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Équipe</h1>
        <p className="text-sm text-muted-foreground">{members.length} collaborateur(s) · {roles.length} rôle(s)</p>
      </div>

      <div className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Collaborateurs</h2>
        <div className="mb-3">
          <InviteUserForm roles={roleOptions} />
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Collaborateur</th>
                <th className="px-3 py-2">Rôle</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Dernière connexion</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <TeamMemberRow key={member.id} member={member} roles={roleOptions} />
              ))}
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Aucun collaborateur.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Rôles &amp; permissions</h2>
        <div className="flex flex-col gap-3">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={{ id: role.id, name: role.name, permissionKeys: role.permissionKeys, memberCount: memberCountByRole.get(role.id) ?? 0 }}
              permissions={PERMISSIONS}
            />
          ))}
          <CreateRoleForm permissions={PERMISSIONS} />
        </div>
      </div>
    </main>
  );
}
