import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { correctFinalizedNote, createNote, finalizeNote, listNoteRevisions } from "./clinical-notes";
import { createPatient } from "./patients";

describe("clinical note finalization and correction", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let patientId = "";
  let practitionerId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Clinical Notes Test Org ${suffix}`, slug: `clinical-notes-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Note-${suffix}` },
    });
    practitionerId = practitioner.id;

    const patient = await createPatient(ctx, { firstName: "Test", lastName: `Note-${suffix}` }, "seed");
    patientId = patient.id;
  });

  afterAll(async () => {
    await prisma.patient.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.practitioner.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  it("rejects correcting a note that was never finalized", async () => {
    const draft = await createNote(ctx, patientId, { practitionerId, content: "Brouillon initial" }, "dr-meyer");
    await expect(
      correctFinalizedNote(ctx, draft.id, "Contenu modifié", "test", "dr-meyer"),
    ).rejects.toThrow(/never finalized/i);
  });

  it("never overwrites a finalized note's content in place — correction leaves a revision", async () => {
    const note = await createNote(ctx, patientId, { practitionerId, content: "Contrôle RAS." }, "dr-meyer");
    await finalizeNote(ctx, note.id);

    const corrected = await correctFinalizedNote(
      ctx,
      note.id,
      "Contrôle : carie détectée sur 16.",
      "Omission lors de la première rédaction",
      "dr-meyer",
    );

    expect(corrected.content).toBe("Contrôle : carie détectée sur 16.");

    const revisions = await listNoteRevisions(ctx, note.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.content).toBe("Contrôle RAS.");
    expect(revisions[0]?.reason).toBe("Omission lors de la première rédaction");
  });

  it("rejects finalizing an already-finalized note", async () => {
    const note = await createNote(ctx, patientId, { practitionerId, content: "Autre note." }, "dr-meyer");
    await finalizeNote(ctx, note.id);
    await expect(finalizeNote(ctx, note.id)).rejects.toThrow(/not found|already finalized/i);
  });
});
