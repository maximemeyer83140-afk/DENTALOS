import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface ClinicUser {
  id: string;
  name: string;
  email: string;
}

/** Every user who can be assigned a task in this clinic — driven by `UserClinicAccess`, the same
 * table `requirePermission` itself checks, so this list can never include someone who has since
 * lost access to the clinic. */
export async function listUsersForClinic(ctx: TenantContext): Promise<ClinicUser[]> {
  const access = await prisma.userClinicAccess.findMany({
    where: { clinicId: ctx.clinicId, user: { organizationId: ctx.organizationId } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return access
    .map((a) => a.user)
    .sort((a, b) => a.name.localeCompare(b.name));
}
