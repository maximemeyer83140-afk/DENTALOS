import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().trim().email("Email invalide."),
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(200),
  roleId: z.string().trim().min(1, "Le rôle est obligatoire."),
  temporaryPassword: z
    .string()
    .min(8, "Le mot de passe provisoire doit contenir au moins 8 caractères."),
});

export const updateUserRoleSchema = z.object({
  roleId: z.string().trim().min(1, "Le rôle est obligatoire."),
});

export const userStatusSchema = z.enum(["active", "invited", "suspended", "disabled"]);

export const setUserStatusSchema = z.object({
  status: userStatusSchema,
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Le nom du rôle est obligatoire.").max(100),
  permissionKeys: z.array(z.string()).default([]),
});

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()).default([]),
});
