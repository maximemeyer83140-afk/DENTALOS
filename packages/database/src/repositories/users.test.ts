import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createClinicUser, listTeamMembers, listUsersForClinic, setUserStatus, updateUserClinicRole } from "./users";

/** ÉTAPE 11 : la liste des assignés possibles pour une tâche doit refléter l'accès clinique réel
 * (UserClinicAccess), jamais tous les utilisateurs de l'organisation sans filtre. */
describe("users repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let otherClinicId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Users Test Org ${suffix}`, slug: `users-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic A", slug: "a" } });
    const otherClinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic B", slug: "b" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;
    otherClinicId = otherClinic.id;

    const role = await prisma.role.create({ data: { organizationId: org.id, name: `Role-${suffix}` } });

    const userA = await prisma.user.create({
      data: { organizationId: org.id, email: `zoe-${suffix}@test.dev`, name: "Zoé Assistante" },
    });
    const userB = await prisma.user.create({
      data: { organizationId: org.id, email: `andre-${suffix}@test.dev`, name: "André Praticien" },
    });
    const otherClinicUser = await prisma.user.create({
      data: { organizationId: org.id, email: `only-other-${suffix}@test.dev`, name: "Autre Clinique" },
    });

    await prisma.userClinicAccess.create({ data: { userId: userA.id, clinicId: clinic.id, roleId: role.id } });
    await prisma.userClinicAccess.create({ data: { userId: userB.id, clinicId: clinic.id, roleId: role.id } });
    await prisma.userClinicAccess.create({ data: { userId: otherClinicUser.id, clinicId: otherClinic.id, roleId: role.id } });
  });

  afterAll(async () => {
    await prisma.userClinicAccess.deleteMany({ where: { user: { organizationId: ctx.organizationId } } });
    await prisma.user.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.role.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  it("lists only users with access to this clinic, alphabetically", async () => {
    const users = await listUsersForClinic(ctx);
    expect(users.map((u) => u.name)).toEqual(["André Praticien", "Zoé Assistante"]);
  });

  it("never includes a user who only has access to another clinic", async () => {
    const users = await listUsersForClinic({ organizationId: ctx.organizationId, clinicId: otherClinicId });
    expect(users.map((u) => u.name)).toEqual(["Autre Clinique"]);
  });
});

/** ÉTAPE 12 : gestion d'équipe — créer un collaborateur avec un rôle, changer son rôle, le
 * suspendre/réactiver, toujours strictement scopé par organisation (le rôle assigné doit
 * appartenir à la même organisation) et par accès clinique réel. */
describe("users repository — team management", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let roleId = "";
  let otherOrgRoleId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Team Test Org ${suffix}`, slug: `team-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const role = await prisma.role.create({ data: { organizationId: org.id, name: `Assistante-${suffix}` } });
    roleId = role.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Team Test Org B ${suffix}`, slug: `team-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({ data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" } });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;
    const otherRole = await prisma.role.create({ data: { organizationId: otherOrg.id, name: `Autre-${suffix}` } });
    otherOrgRoleId = otherRole.id;
  });

  afterAll(async () => {
    await prisma.userClinicAccess.deleteMany({ where: { user: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.role.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("creates a teammate, active immediately, with the given role for this clinic", async () => {
    const member = await createClinicUser(ctx, {
      email: `nouvelle-${suffix}@test.dev`,
      name: "Nouvelle Collaboratrice",
      roleId,
      temporaryPassword: "ChangeMe123!",
    });
    expect(member.status).toBe("active");
    expect(member.roleId).toBe(roleId);

    const team = await listTeamMembers(ctx);
    expect(team.some((m) => m.id === member.id)).toBe(true);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(stored.passwordHash).not.toBe("ChangeMe123!");
    expect(stored.passwordHash).not.toBeNull();
  });

  it("refuses to create a user with a role from another organization", async () => {
    await expect(
      createClinicUser(ctx, {
        email: `x-${suffix}@test.dev`,
        name: "X",
        roleId: otherOrgRoleId,
        temporaryPassword: "ChangeMe123!",
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("refuses to create a second user with an email already in use", async () => {
    const email = `duplicate-${suffix}@test.dev`;
    await createClinicUser(ctx, { email, name: "Premier", roleId, temporaryPassword: "ChangeMe123!" });
    await expect(
      createClinicUser(ctx, { email, name: "Second", roleId, temporaryPassword: "ChangeMe123!" }),
    ).rejects.toThrow(/already exists/i);
  });

  it("changes a teammate's role for this clinic only", async () => {
    const member = await createClinicUser(ctx, {
      email: `role-change-${suffix}@test.dev`,
      name: "Change de rôle",
      roleId,
      temporaryPassword: "ChangeMe123!",
    });
    const newRole = await prisma.role.create({ data: { organizationId: ctx.organizationId, name: `Praticien-${suffix}` } });

    await updateUserClinicRole(ctx, member.id, newRole.id);
    const team = await listTeamMembers(ctx);
    expect(team.find((m) => m.id === member.id)?.roleId).toBe(newRole.id);
  });

  it("suspends and reactivates a teammate", async () => {
    const member = await createClinicUser(ctx, {
      email: `suspend-${suffix}@test.dev`,
      name: "À suspendre",
      roleId,
      temporaryPassword: "ChangeMe123!",
    });

    await setUserStatus(ctx, member.id, "suspended");
    let team = await listTeamMembers(ctx);
    expect(team.find((m) => m.id === member.id)?.status).toBe("suspended");

    await setUserStatus(ctx, member.id, "active");
    team = await listTeamMembers(ctx);
    expect(team.find((m) => m.id === member.id)?.status).toBe("active");
  });

  it("never touches a user who has no access to this clinic", async () => {
    const foreignMember = await createClinicUser(otherCtx, {
      email: `foreign-${suffix}@test.dev`,
      name: "Étranger",
      roleId: otherOrgRoleId,
      temporaryPassword: "ChangeMe123!",
    });

    await expect(updateUserClinicRole(ctx, foreignMember.id, roleId)).rejects.toThrow(/not found|no access/i);
    await expect(setUserStatus(ctx, foreignMember.id, "suspended")).rejects.toThrow(/not found|no access/i);
  });
});
