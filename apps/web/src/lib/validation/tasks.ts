import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const taskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const taskStatusSchema = z.enum(["open", "in_progress", "done", "cancelled"]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  assignedToUserId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  priority: taskPrioritySchema.optional(),
  dueAt: z.preprocess(emptyToUndefined, z.string().optional()),
});

export const updateTaskStatusSchema = z.object({
  status: taskStatusSchema,
});
