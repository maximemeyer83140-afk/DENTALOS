import type { TenantContext } from "@dentalos/database";

import { auth } from "./auth";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * The ONLY sanctioned way to obtain a `TenantContext` for a server action / route handler.
 * `clinicId` is the clinic the caller *asked* to act on (e.g. a route param) — this function is
 * what verifies that the authenticated user actually has access to it and holds the required
 * permission, before any repository call is allowed to run. Never construct a `TenantContext` by
 * hand from client input (ARCHITECTURE.md §5).
 */
export async function requirePermission(
  clinicId: string,
  permissionKey: string,
): Promise<TenantContext & { userId: string; roleId: string }> {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();

  const clinicAccess = session.user.clinics.find((access) => access.clinicId === clinicId);
  if (!clinicAccess) {
    throw new ForbiddenError(`User ${session.user.id} has no access to clinic ${clinicId}`);
  }
  if (!clinicAccess.permissions.includes(permissionKey)) {
    throw new ForbiddenError(`User ${session.user.id} is missing permission ${permissionKey}`);
  }

  return {
    organizationId: session.user.organizationId,
    clinicId,
    userId: session.user.id,
    roleId: clinicAccess.roleId,
  };
}
