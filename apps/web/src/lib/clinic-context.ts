import { cookies } from "next/headers";

import { auth } from "./auth";
import { UnauthenticatedError } from "./rbac";

/** Set by `setActiveClinicAction` (ÉTAPE 15) whenever a user with access to more than one clinic
 * picks one from `ClinicSwitcher` — read here on every request so the whole app (every page,
 * every Server Action) acts on the clinic the user actually chose. */
export const ACTIVE_CLINIC_COOKIE = "dentalos-active-clinic";

/**
 * The single source of truth for "which clinic is this request acting on" — every page and
 * Server Action calls this rather than reading `session.user.clinics` directly. Kept under its
 * original name (`getDefaultClinicId`, a Phase 2 decision) even though it's no longer just "the
 * first clinic": renaming it would touch every page/action in the app for no behavioral gain, and
 * the name still reads correctly as "the clinic to default to" — falling back to `clinics[0]` is
 * exactly the "default" this always was, now overridable by cookie.
 */
export async function getDefaultClinicId(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const clinics = session.user.clinics;
  if (clinics.length === 0) throw new Error("Signed-in user has no clinic access");

  const cookieStore = await cookies();
  const activeClinicId = cookieStore.get(ACTIVE_CLINIC_COOKIE)?.value;
  // Never trust the cookie blindly — it only wins if it names a clinic this session actually has
  // access to right now (access can change between visits; a stale/tampered cookie must never
  // grant a clinic the user no longer has).
  if (activeClinicId && clinics.some((c) => c.clinicId === activeClinicId)) {
    return activeClinicId;
  }
  return clinics[0]!.clinicId;
}
