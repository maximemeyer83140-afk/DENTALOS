import { auth } from "./auth";
import { UnauthenticatedError } from "./rbac";

/**
 * Until a clinic switcher exists (tracked as a Phase 2 decision, see docs/phases/PHASE_2.md),
 * every page acts on the first clinic the signed-in user has access to. A user with access to
 * several clinics cannot yet pick a different one from the UI — known, documented limitation.
 */
export async function getDefaultClinicId(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const clinicId = session.user.clinics[0]?.clinicId;
  if (!clinicId) throw new Error("Signed-in user has no clinic access");
  return clinicId;
}
