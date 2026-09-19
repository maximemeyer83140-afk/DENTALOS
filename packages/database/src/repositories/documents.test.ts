import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createDocumentRecord, getDocument, listDocumentsForPatient, updateDocument } from "./documents";
import { createPatient } from "./patients";

/**
 * ÉTAPE 5 : chaque document doit rester attaché à son patient et à son organisation — jamais
 * mélangé avec ceux d'un autre patient ou d'une autre organisation (même schéma de test tenant que
 * les autres repositories).
 */
describe("documents repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let patientId = "";
  let otherPatientId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Documents Test Org ${suffix}`, slug: `documents-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Documents Test Org B ${suffix}`, slug: `documents-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({
      data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" },
    });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;

    const patient = await createPatient(ctx, { firstName: "Doc", lastName: `Test-${suffix}` }, "seed");
    patientId = patient.id;
    const otherPatient = await createPatient(otherCtx, { firstName: "Other", lastName: `Test-${suffix}` }, "seed");
    otherPatientId = otherPatient.id;
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.patient.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("records a document and lists it for its patient", async () => {
    const doc = await createDocumentRecord(
      ctx,
      {
        patientId,
        category: "radiograph",
        fileName: "pano.jpg",
        storageKey: `${ctx.organizationId}/pano.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 1234,
        comment: "Panoramique initiale",
      },
      "dr-meyer",
    );
    expect(doc.fileName).toBe("pano.jpg");
    expect(doc.comment).toBe("Panoramique initiale");
    expect(doc.isArchived).toBe(false);

    const list = await listDocumentsForPatient(ctx, patientId);
    expect(list.some((d) => d.id === doc.id)).toBe(true);
  });

  it("refuses to attach a document to a patient from another organization", async () => {
    await expect(
      createDocumentRecord(
        ctx,
        {
          patientId: otherPatientId,
          category: "other",
          fileName: "x.pdf",
          storageKey: "x",
          mimeType: "application/pdf",
          sizeBytes: 1,
        },
        "dr-meyer",
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("renames and reclassifies a document without touching its stored bytes", async () => {
    const doc = await createDocumentRecord(
      ctx,
      { patientId, category: "other", fileName: "scan.pdf", storageKey: "k1", mimeType: "application/pdf", sizeBytes: 10 },
      "dr-meyer",
    );
    const updated = await updateDocument(ctx, doc.id, { fileName: "consentement-implant.pdf", category: "consent" });
    expect(updated.fileName).toBe("consentement-implant.pdf");
    expect(updated.category).toBe("consent");
    expect(updated.storageKey).toBe("k1");
  });

  it("archiving hides a document from the default list but keeps it retrievable", async () => {
    const doc = await createDocumentRecord(
      ctx,
      { patientId, category: "letter", fileName: "courrier.pdf", storageKey: "k2", mimeType: "application/pdf", sizeBytes: 5 },
      "dr-meyer",
    );

    await updateDocument(ctx, doc.id, { isArchived: true });
    const defaultList = await listDocumentsForPatient(ctx, patientId);
    expect(defaultList.some((d) => d.id === doc.id)).toBe(false);

    const withArchived = await listDocumentsForPatient(ctx, patientId, { includeArchived: true });
    expect(withArchived.some((d) => d.id === doc.id)).toBe(true);

    const fetched = await getDocument(ctx, doc.id);
    expect(fetched.isArchived).toBe(true);
  });

  it("never returns or updates another organization's document", async () => {
    const foreignDoc = await createDocumentRecord(
      otherCtx,
      { patientId: otherPatientId, category: "other", fileName: "foreign.pdf", storageKey: "k3", mimeType: "application/pdf", sizeBytes: 1 },
      "seed",
    );

    await expect(getDocument(ctx, foreignDoc.id)).rejects.toThrow(/not found/i);
    await expect(updateDocument(ctx, foreignDoc.id, { fileName: "hacked.pdf" })).rejects.toThrow(/not found/i);
  });
});
