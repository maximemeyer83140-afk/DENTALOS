import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@dentalos/database";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticator } from "otplib";

import { loginSchema } from "./validation/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        totpCode: { label: "Code à 6 chiffres", type: "text" },
      },
      authorize: async (raw) => {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password, totpCode } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash || user.status !== "active") return null;

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) return null;

        if (user.mfaEnabled) {
          if (!totpCode || !user.mfaSecret) return null;
          const totpValid = authenticator.check(totpCode, user.mfaSecret);
          if (!totpValid) return null;
        }

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    session: async ({ session, user }) => {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          clinicAccess: {
            include: {
              clinic: true,
              role: { include: { permissions: { include: { permission: true } } } },
            },
          },
        },
      });
      if (!dbUser) return session;

      session.user.id = dbUser.id;
      session.user.organizationId = dbUser.organizationId;
      session.user.clinics = dbUser.clinicAccess.map((access) => ({
        clinicId: access.clinicId,
        clinicName: access.clinic.name,
        roleId: access.roleId,
        permissions: access.role.permissions.map((rolePermission) => rolePermission.permission.key),
      }));

      return session;
    },
  },
});
