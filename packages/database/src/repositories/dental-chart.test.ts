import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { getChartAsOf, getCurrentChart, listChartHistory, recordToothCondition } from "./dental-chart";
import { createPatient } from "./patients";

describe("dental chart versioning", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let patientId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Dental Chart Test Org ${suffix}`, slug: `dental-chart-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const patient = await createPatient(ctx, { firstName: "Test", lastName: `Chart-${suffix}` }, "seed");
    patientId = patient.id;
  });

  afterAll(async () => {
    await prisma.patient.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  it("has no current chart before any tooth is recorded", async () => {
    const current = await getCurrentChart(ctx, patientId);
    expect(current).toBeNull();
  });

  it("creates a new chart snapshot on every recorded change, never mutating the previous one", async () => {
    const afterFirst = await recordToothCondition(ctx, patientId, { toothNumber: 16, condition: "caries" }, "dr-meyer");
    expect(afterFirst.entries).toHaveLength(1);
    expect(afterFirst.entries[0]?.condition).toBe("caries");
    const firstChartId = afterFirst.id;

    const afterSecond = await recordToothCondition(ctx, patientId, { toothNumber: 16, condition: "composite" }, "dr-meyer");
    expect(afterSecond.id).not.toBe(firstChartId);
    expect(afterSecond.entries).toHaveLength(1);
    expect(afterSecond.entries[0]?.condition).toBe("composite");

    // The first snapshot is untouched and no longer current.
    const firstChart = await prisma.dentalChart.findUnique({ where: { id: firstChartId }, include: { entries: true } });
    expect(firstChart?.isCurrent).toBe(false);
    expect(firstChart?.entries[0]?.condition).toBe("caries");
  });

  it("accumulates entries for different teeth across snapshots", async () => {
    const afterThird = await recordToothCondition(ctx, patientId, { toothNumber: 26, condition: "missing" }, "dr-meyer");
    const conditions = afterThird.entries.map((e) => [e.toothNumber, e.condition]).sort();
    expect(conditions).toEqual([
      [16, "composite"],
      [26, "missing"],
    ]);
  });

  it("getChartAsOf resolves to the snapshot in effect at a given time, not the latest one", async () => {
    const history = await listChartHistory(ctx, patientId);
    expect(history.length).toBeGreaterThanOrEqual(3);

    const oldest = history[history.length - 1];
    expect(oldest).toBeDefined();
    const asOf = await getChartAsOf(ctx, patientId, oldest!.asOfDate);
    expect(asOf?.id).toBe(oldest!.id);
    expect(asOf?.entries[0]?.condition).toBe("caries");
  });
});
