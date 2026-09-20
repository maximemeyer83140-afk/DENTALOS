import type { Role } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export type RoleWithPermissions = Role & { permissionKeys: string[] };

/** A role belongs to the organization (shared across every clinic of that org, `UserClinicAccess`
 * is what actually scopes a user's role to one clinic) — so this lists by `organizationId`, not
 * `clinicId`, unlike almost every other repository in this codebase. */
export async function listRoles(ctx: TenantContext): Promise<RoleWithPermissions[]> {
  const roles = await prisma.role.findMany({
    where: { organizationId: ctx.organizationId },
    include: { permissions: { include: { permission: true } } },
    orderBy: { name: "asc" },
  });
  return roles.map((role) => ({
    ...role,
    permissionKeys: role.permissions.map((rp) => rp.permission.key),
  }));
}

export async function getRole(ctx: TenantContext, roleId: string): Promise<RoleWithPermissions> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, organizationId: ctx.organizationId },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) throw new NotFoundError(`Role ${roleId} not found`);
  return { ...role, permissionKeys: role.permissions.map((rp) => rp.permission.key) };
}

export async function createRole(ctx: TenantContext, name: string, permissionKeys: string[]): Promise<RoleWithPermissions> {
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });

  const role = await prisma.role.create({
    data: {
      organizationId: ctx.organizationId,
      name,
      permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
    },
  });
  return getRole(ctx, role.id);
}

/** Replaces the role's whole permission set in one transaction — a role's permissions are always
 * edited as a complete set from the UI's checkbox matrix, never one key added/removed at a time,
 * so there's no partial-update case to support. */
export async function updateRolePermissions(
  ctx: TenantContext,
  roleId: string,
  permissionKeys: string[],
): Promise<RoleWithPermissions> {
  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId: ctx.organizationId } });
  if (!role) throw new NotFoundError(`Role ${roleId} not found`);

  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    }),
  ]);

  return getRole(ctx, roleId);
}
