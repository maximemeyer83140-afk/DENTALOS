import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { PERMISSIONS } from "../permissions";
import { createRole, getRole, listRoles, updateRolePermissions } from "./roles";

/** ÉTAPE 12 : un rôle appartient à l'organisation (partagé entre ses cliniques) — jamais visible
 * ni modifiable depuis une autre organisation, et ses permissions se remplacent toujours en bloc. */
describe("roles repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };

  beforeAll(async () => {
    for (const permission of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { key: permission.key },
        update: {},
        create: permission,
      });
    }

    const org = await prisma.organization.create({
      data: { name: `Roles Test Org ${suffix}`, slug: `roles-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Roles Test Org B ${suffix}`, slug: `roles-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({ data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" } });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;
  });

  afterAll(async () => {
    await prisma.rolePermission.deleteMany({ where: { role: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } } });
    await prisma.role.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("creates a role with the given permissions", async () => {
    const role = await createRole(ctx, `Assistante-${suffix}`, ["patients.read", "agenda.read"]);
    expect(role.permissionKeys.sort()).toEqual(["agenda.read", "patients.read"]);

    const list = await listRoles(ctx);
    expect(list.some((r) => r.id === role.id)).toBe(true);
  });

  it("never lists or fetches another organization's role", async () => {
    const foreignRole = await createRole(otherCtx, `Foreign-${suffix}`, []);
    const list = await listRoles(ctx);
    expect(list.some((r) => r.id === foreignRole.id)).toBe(false);
    await expect(getRole(ctx, foreignRole.id)).rejects.toThrow(/not found/i);
  });

  it("replaces the whole permission set rather than merging", async () => {
    const role = await createRole(ctx, `Praticien-${suffix}`, ["patients.read", "patients.write", "agenda.read"]);
    const updated = await updateRolePermissions(ctx, role.id, ["invoices.read"]);
    expect(updated.permissionKeys).toEqual(["invoices.read"]);
  });

  it("refuses to update another organization's role", async () => {
    const foreignRole = await createRole(otherCtx, `Foreign2-${suffix}`, []);
    await expect(updateRolePermissions(ctx, foreignRole.id, ["patients.read"])).rejects.toThrow(/not found/i);
  });
});
