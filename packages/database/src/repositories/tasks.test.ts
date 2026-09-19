import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createPatient } from "./patients";
import { createTask, listTasks, listTasksForPatient, updateTaskStatus } from "./tasks";

/** ÉTAPE 11 : le tableau de bord des tâches internes ne doit remonter que les tâches ouvertes par
 * défaut, triées par échéance, et rester strictement scopé par clinique/organisation. */
describe("tasks repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let patientId = "";
  let userId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Tasks Test Org ${suffix}`, slug: `tasks-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Tasks Test Org B ${suffix}`, slug: `tasks-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({
      data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" },
    });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;

    const patient = await createPatient(ctx, { firstName: "Task", lastName: `Test-${suffix}` }, "seed");
    patientId = patient.id;

    const role = await prisma.role.create({ data: { organizationId: org.id, name: `Role-${suffix}` } });
    const user = await prisma.user.create({
      data: { organizationId: org.id, email: `assignee-${suffix}@test.dev`, name: "Assistante" },
    });
    await prisma.userClinicAccess.create({ data: { userId: user.id, clinicId: clinic.id, roleId: role.id } });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.userClinicAccess.deleteMany({ where: { user: { organizationId: ctx.organizationId } } });
    await prisma.user.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.role.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.patient.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("creates a task and defaults to normal priority / open status", async () => {
    const task = await createTask(ctx, { title: "Rappeler le laboratoire" }, "dr-meyer");
    expect(task.priority).toBe("normal");
    expect(task.status).toBe("open");

    const list = await listTasks(ctx);
    expect(list.some((t) => t.id === task.id)).toBe(true);
  });

  it("refuses to assign a task to a user without access to the clinic", async () => {
    await expect(
      createTask(ctx, { title: "x", assignedToUserId: "does-not-exist" }, "dr-meyer"),
    ).rejects.toThrow(/not found|no access/i);
  });

  it("refuses to link a task to a patient from another organization", async () => {
    const otherPatient = await createPatient(otherCtx, { firstName: "Other", lastName: `Test-${suffix}` }, "seed");
    await expect(
      createTask(ctx, { title: "x", patientId: otherPatient.id }, "dr-meyer"),
    ).rejects.toThrow(/not found/i);
  });

  it("links a task to a patient and to an assignee with real clinic access", async () => {
    const task = await createTask(ctx, { title: "Préparer le dossier", patientId, assignedToUserId: userId }, "dr-meyer");
    expect(task.patientId).toBe(patientId);
    expect(task.assignedToUserId).toBe(userId);

    const patientTasks = await listTasksForPatient(ctx, patientId);
    expect(patientTasks.some((t) => t.id === task.id)).toBe(true);
  });

  it("the board only shows open tasks by default, ordered by earliest due date", async () => {
    const soon = await createTask(ctx, { title: "Urgent", dueAt: new Date("2026-02-01") }, "dr-meyer");
    const later = await createTask(ctx, { title: "Plus tard", dueAt: new Date("2026-06-01") }, "dr-meyer");
    const done = await createTask(ctx, { title: "Fini" }, "dr-meyer");
    await updateTaskStatus(ctx, done.id, "done");

    const board = await listTasks(ctx);
    expect(board.some((t) => t.id === done.id)).toBe(false);
    const ids = board.map((t) => t.id);
    expect(ids.indexOf(soon.id)).toBeLessThan(ids.indexOf(later.id));
  });

  it("never updates or lists another organization's task", async () => {
    const foreignTask = await createTask(otherCtx, { title: "Foreign" }, "seed");
    await expect(updateTaskStatus(ctx, foreignTask.id, "done")).rejects.toThrow(/not found/i);
    const board = await listTasks(ctx);
    expect(board.some((t) => t.id === foreignTask.id)).toBe(false);
  });
});
