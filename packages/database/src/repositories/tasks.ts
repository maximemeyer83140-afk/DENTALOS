import type { Task, TaskPriority, TaskStatus } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface CreateTaskInput {
  title: string;
  description?: string | undefined;
  patientId?: string | undefined;
  assignedToUserId?: string | undefined;
  priority?: TaskPriority | undefined;
  dueAt?: Date | undefined;
}

export interface ListTasksOptions {
  /** Defaults to every open task (open / in_progress) — a task board that shows `done` and
   * `cancelled` by default just buries what still needs doing. */
  statuses?: TaskStatus[] | undefined;
  assignedToUserId?: string | undefined;
  patientId?: string | undefined;
}

const OPEN_STATUSES: TaskStatus[] = ["open", "in_progress"];

export type TaskWithPatient = Task & {
  patient: { id: string; firstName: string; lastName: string } | null;
};

export async function listTasks(ctx: TenantContext, options: ListTasksOptions = {}): Promise<TaskWithPatient[]> {
  return prisma.task.findMany({
    where: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      status: { in: options.statuses ?? OPEN_STATUSES },
      ...(options.assignedToUserId ? { assignedToUserId: options.assignedToUserId } : {}),
      ...(options.patientId ? { patientId: options.patientId } : {}),
    },
    include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    // Échéance la plus proche d'abord (les tâches sans échéance en dernier), pour que le tableau
    // de bord se lise comme une liste d'urgence plutôt qu'un ordre d'insertion arbitraire.
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
}

export async function listTasksForPatient(ctx: TenantContext, patientId: string): Promise<Task[]> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  return prisma.task.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTask(ctx: TenantContext, input: CreateTaskInput, createdBy: string): Promise<Task> {
  if (input.patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: input.patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
      select: { id: true },
    });
    if (!patient) throw new NotFoundError(`Patient ${input.patientId} not found`);
  }
  if (input.assignedToUserId) {
    const access = await prisma.userClinicAccess.findFirst({
      where: { userId: input.assignedToUserId, clinicId: ctx.clinicId },
      select: { id: true },
    });
    if (!access) throw new NotFoundError(`User ${input.assignedToUserId} has no access to this clinic`);
  }

  return prisma.task.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      title: input.title,
      description: input.description,
      patientId: input.patientId,
      assignedToUserId: input.assignedToUserId,
      priority: input.priority ?? "normal",
      dueAt: input.dueAt,
      createdBy,
    },
  });
}

export async function updateTaskStatus(ctx: TenantContext, taskId: string, status: TaskStatus): Promise<Task> {
  const result = await prisma.task.updateMany({
    where: { id: taskId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: { status },
  });
  if (result.count === 0) throw new NotFoundError(`Task ${taskId} not found`);

  return prisma.task.findFirstOrThrow({
    where: { id: taskId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
}
