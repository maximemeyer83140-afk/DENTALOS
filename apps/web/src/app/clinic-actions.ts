"use server";

import { cookies } from "next/headers";

import { ACTIVE_CLINIC_COOKIE } from "@/lib/clinic-context";
import { auth } from "@/lib/auth";
import { ForbiddenError, UnauthenticatedError } from "@/lib/rbac";

/**
 * ÉTAPE 15 : the only sanctioned way to change which clinic the app acts on — never trusts the
 * `clinicId` a client sends without checking it against the signed-in user's own clinic access
 * first, same principle as `requirePermission` itself.
 */
export async function setActiveClinicAction(clinicId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  if (!session.user.clinics.some((c) => c.clinicId === clinicId)) {
    throw new ForbiddenError(`User ${session.user.id} has no access to clinic ${clinicId}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CLINIC_COOKIE, clinicId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
