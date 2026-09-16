import type { DefaultSession } from "next-auth";

export interface SessionClinicAccess {
  clinicId: string;
  clinicName: string;
  roleId: string;
  permissions: string[];
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      clinics: SessionClinicAccess[];
    } & DefaultSession["user"];
  }
}
