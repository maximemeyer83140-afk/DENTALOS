import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { listUsersForClinic } from "./users";

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
