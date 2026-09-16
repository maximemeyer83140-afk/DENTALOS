import { PrismaClient } from "@prisma/client";

import { PERMISSIONS } from "./permissions";

/**
 * Development seed: a fictional organization ("Cabinet Dentaire Léman") with RBAC permissions,
 * an Owner role, and two practitioners, so local dashboards have something real to render against.
 * NEVER run against a production database and NEVER seed real patient data (see section 77).
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the development seed against NODE_ENV=production");
  }

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { category: permission.category, description: permission.description },
      create: permission,
    });
  }

  const organization = await prisma.organization.upsert({
    where: { slug: "cabinet-dentaire-leman" },
    update: {},
    create: {
      name: "Cabinet Dentaire Léman",
      slug: "cabinet-dentaire-leman",
      defaultLocale: "fr",
      defaultCurrency: "CHF",
      timezone: "Europe/Zurich",
    },
  });

  const clinic = await prisma.clinic.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: "geneve" } },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Cabinet Dentaire Léman — Genève",
      slug: "geneve",
      city: "Genève",
      canton: "GE",
      country: "CH",
    },
  });

  const ownerRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Owner" } },
    update: {},
    create: { organizationId: organization.id, name: "Owner", isSystem: true },
  });

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: ownerRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  const practitioners = [
    { firstName: "Maxime", lastName: "Meyer", specialty: "Médecine dentaire générale" },
    { firstName: "Sophie", lastName: "Martin", specialty: "Orthodontie" },
  ];

  for (const practitioner of practitioners) {
    await prisma.practitioner.upsert({
      where: {
        clinicId_firstName_lastName: {
          clinicId: clinic.id,
          firstName: practitioner.firstName,
          lastName: practitioner.lastName,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        clinicId: clinic.id,
        firstName: practitioner.firstName,
        lastName: practitioner.lastName,
        specialty: practitioner.specialty,
        status: "active",
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded organization "${organization.name}" (${organization.id}).`);
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
