import bcrypt from "bcryptjs";
import type { UserStatus } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface ClinicUser {
  id: string;
  name: string;
  email: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  lastLoginAt: Date | null;
  roleId: string;
  roleName: string;
}

export interface CreateClinicUserInput {
  email: string;
  name: string;
  roleId: string;
  temporaryPassword: string;
}

/** Every user who can be assigned a task in this clinic — driven by `UserClinicAccess`, the same
 * table `requirePermission` itself checks, so this list can never include someone who has since
 * lost access to the clinic. */
export async function listUsersForClinic(ctx: TenantContext): Promise<ClinicUser[]> {
  const access = await prisma.userClinicAccess.findMany({
    where: { clinicId: ctx.clinicId, user: { organizationId: ctx.organizationId } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return access
    .map((a) => a.user)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The team-management screen's listing — same scope as `listUsersForClinic` (only users with
 * real access to this clinic) but with the status/role detail that screen needs to render. */
export async function listTeamMembers(ctx: TenantContext): Promise<TeamMember[]> {
  const access = await prisma.userClinicAccess.findMany({
    where: { clinicId: ctx.clinicId, user: { organizationId: ctx.organizationId } },
    include: { user: true, role: true },
  });

  return access
    .map((a) => ({
      id: a.user.id,
      name: a.user.name,
      email: a.user.email,
      status: a.user.status,
      lastLoginAt: a.user.lastLoginAt,
      roleId: a.roleId,
      roleName: a.role.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Creates a new teammate and grants them access to the current clinic in one step — there's no
 * standalone "create a user with no clinic access" case in this product, a user only ever exists
 * to work in at least one clinic. No invite email is sent (see PHASE_8.md limitations): the admin
 * communicates `temporaryPassword` to the teammate out of band, who can sign in with it
 * immediately (created `active`, not `invited` — there is no accept-invite flow to unblock it). */
export async function createClinicUser(ctx: TenantContext, input: CreateClinicUserInput): Promise<TeamMember> {
  const role = await prisma.role.findFirst({ where: { id: input.roleId, organizationId: ctx.organizationId } });
  if (!role) throw new NotFoundError(`Role ${input.roleId} not found`);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error(`A user with email ${input.email} already exists`);

  const passwordHash = await bcrypt.hash(input.temporaryPassword, 12);

  const user = await prisma.user.create({
    data: {
      organizationId: ctx.organizationId,
      email: input.email,
      name: input.name,
      passwordHash,
      status: "active",
      clinicAccess: { create: { clinicId: ctx.clinicId, roleId: input.roleId } },
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    roleId: input.roleId,
    roleName: role.name,
  };
}

/** Changes a teammate's role for this clinic specifically — `Role` is shared across the
 * organization's clinics, but the *assignment* of a role to a user is always per clinic
 * (`UserClinicAccess`), so this never touches their role in any other clinic they may access. */
export async function updateUserClinicRole(ctx: TenantContext, userId: string, roleId: string): Promise<void> {
  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId: ctx.organizationId } });
  if (!role) throw new NotFoundError(`Role ${roleId} not found`);

  const result = await prisma.userClinicAccess.updateMany({
    where: { userId, clinicId: ctx.clinicId, user: { organizationId: ctx.organizationId } },
    data: { roleId },
  });
  if (result.count === 0) throw new NotFoundError(`User ${userId} has no access to this clinic`);
}

/** Suspends or reactivates a user — `User.status` is organization-wide (a single login, not one
 * per clinic), so this is gated on the target user having access to *this* clinic (proof the
 * acting admin's `users.manage` permission actually reaches them) rather than scoped by clinicId
 * directly, since `User` itself carries no `clinicId`. */
export async function setUserStatus(ctx: TenantContext, userId: string, status: UserStatus): Promise<void> {
  const access = await prisma.userClinicAccess.findFirst({
    where: { userId, clinicId: ctx.clinicId, user: { organizationId: ctx.organizationId } },
  });
  if (!access) throw new NotFoundError(`User ${userId} has no access to this clinic`);

  await prisma.user.update({ where: { id: userId }, data: { status } });
}
