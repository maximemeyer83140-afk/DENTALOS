import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { listPractitioners } from "./practitioners";

/**
 * The one non-negotiable test (section 64 of the brief): a user scoped to Organization A must
 * never see Organization B's data. This requires a real Postgres connection (DATABASE_URL) — it
 * is an integration test, not a unit test, and is the first thing to run once `pnpm install` and
 * a database are available (see docs/phases/PHASE_1.md Definition of Done).
 */
describe("tenant isolation — listPractitioners", () => {
  const suffix = randomUUID().slice(0, 8);
  const orgAIds: { organizationId: string; clinicId: string } = { organizationId: "", clinicId: "" };
  const orgBIds: { organizationId: string; clinicId: string } = { organizationId: "", clinicId: "" };

  beforeAll(async () => {
    const orgA = await prisma.organization.create({
      data: { name: `Tenant Test Org A ${suffix}`, slug: `tenant-test-org-a-${suffix}` },
    });
    const clinicA = await prisma.clinic.create({
      data: { organizationId: orgA.id, name: "Clinic A", slug: "main" },
    });
    await prisma.practitioner.create({
      data: {
        organizationId: orgA.id,
        clinicId: clinicA.id,
        firstName: "Alice",
        lastName: `OrgA-${suffix}`,
      },
    });
    orgAIds.organizationId = orgA.id;
    orgAIds.clinicId = clinicA.id;

    const orgB = await prisma.organization.create({
      data: { name: `Tenant Test Org B ${suffix}`, slug: `tenant-test-org-b-${suffix}` },
    });
    const clinicB = await prisma.clinic.create({
      data: { organizationId: orgB.id, name: "Clinic B", slug: "main" },
    });
    await prisma.practitioner.create({
      data: {
        organizationId: orgB.id,
        clinicId: clinicB.id,
        firstName: "Bob",
        lastName: `OrgB-${suffix}`,
      },
    });
    orgBIds.organizationId = orgB.id;
    orgBIds.clinicId = clinicB.id;
  });

  afterAll(async () => {
    await prisma.practitioner.deleteMany({
      where: { organizationId: { in: [orgAIds.organizationId, orgBIds.organizationId] } },
    });
    await prisma.clinic.deleteMany({
      where: { organizationId: { in: [orgAIds.organizationId, orgBIds.organizationId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAIds.organizationId, orgBIds.organizationId] } },
    });
  });

  it("never returns another organization's practitioners", async () => {
    const resultsForA = await listPractitioners(orgAIds);

    expect(resultsForA.length).toBeGreaterThan(0);
    expect(resultsForA.every((p) => p.organizationId === orgAIds.organizationId)).toBe(true);
    expect(resultsForA.some((p) => p.organizationId === orgBIds.organizationId)).toBe(false);
    expect(resultsForA.some((p) => p.lastName.startsWith("OrgB-"))).toBe(false);
  });

  it("a clinic-scoped query for org B never leaks org A's data", async () => {
    const resultsForB = await listPractitioners(orgBIds);

    expect(resultsForB.every((p) => p.organizationId === orgBIds.organizationId)).toBe(true);
    expect(resultsForB.some((p) => p.lastName.startsWith("OrgA-"))).toBe(false);
  });
});
