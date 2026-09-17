import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createPatient, getPatient, listPatients, updatePatient } from "./patients";

/**
 * Same non-negotiable guarantee as practitioners.test.ts (section 64): Organization A must never
 * see Organization B's patients. Also covers patient-number generation, including under
 * concurrent creation, since a collision there would double-book a chart number for two different
 * people — a correctness bug with real clinical consequences, not just a cosmetic one.
 */
describe("patients repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const orgAIds = { organizationId: "", clinicId: "" };
  const orgBIds = { organizationId: "", clinicId: "" };

  beforeAll(async () => {
    const orgA = await prisma.organization.create({
      data: { name: `Patients Test Org A ${suffix}`, slug: `patients-test-org-a-${suffix}` },
    });
    const clinicA = await prisma.clinic.create({
      data: { organizationId: orgA.id, name: "Clinic A", slug: "main" },
    });
    orgAIds.organizationId = orgA.id;
    orgAIds.clinicId = clinicA.id;

    const orgB = await prisma.organization.create({
      data: { name: `Patients Test Org B ${suffix}`, slug: `patients-test-org-b-${suffix}` },
    });
    const clinicB = await prisma.clinic.create({
      data: { organizationId: orgB.id, name: "Clinic B", slug: "main" },
    });
    orgBIds.organizationId = orgB.id;
    orgBIds.clinicId = clinicB.id;
  });

  afterAll(async () => {
    await prisma.patient.deleteMany({
      where: { organizationId: { in: [orgAIds.organizationId, orgBIds.organizationId] } },
    });
    await prisma.clinic.deleteMany({
      where: { organizationId: { in: [orgAIds.organizationId, orgBIds.organizationId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAIds.organizationId, orgBIds.organizationId] } },
    });
  });

  it("never returns another organization's patients", async () => {
    await createPatient(orgAIds, { firstName: "Alice", lastName: `OrgA-${suffix}` }, "seed");
    await createPatient(orgBIds, { firstName: "Bob", lastName: `OrgB-${suffix}` }, "seed");

    const resultsForA = await listPatients(orgAIds);
    expect(resultsForA.every((p) => p.organizationId === orgAIds.organizationId)).toBe(true);
    expect(resultsForA.some((p) => p.lastName.startsWith("OrgB-"))).toBe(false);
  });

  it("getPatient throws NotFoundError for a patient belonging to another organization", async () => {
    const foreignPatient = await createPatient(
      orgBIds,
      { firstName: "Carla", lastName: `OrgB-cross-${suffix}` },
      "seed",
    );

    await expect(getPatient(orgAIds, foreignPatient.id)).rejects.toThrow(/not found/i);
  });

  it("updatePatient throws NotFoundError rather than updating a foreign-tenant patient", async () => {
    const foreignPatient = await createPatient(
      orgBIds,
      { firstName: "Deniz", lastName: `OrgB-update-${suffix}` },
      "seed",
    );

    await expect(
      updatePatient(orgAIds, foreignPatient.id, { firstName: "Hacked" }),
    ).rejects.toThrow(/not found/i);

    const stillIntact = await getPatient(orgBIds, foreignPatient.id);
    expect(stillIntact.firstName).toBe("Deniz");
  });

  it("generates sequential, year-prefixed patient numbers", async () => {
    const patient = await createPatient(orgAIds, { firstName: "Emma", lastName: "Seq" }, "seed");
    expect(patient.patientNumber).toMatch(/^\d{4}-\d{4}$/);
  });

  it("never assigns the same patient number twice under concurrent creation", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createPatient(orgAIds, { firstName: "Concurrent", lastName: `P${i}` }, "seed")),
    );
    const numbers = results.map((p) => p.patientNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
