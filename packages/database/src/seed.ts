import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { PERMISSIONS } from "./permissions";
import { SSO_TARIFF_ITEMS } from "./seed-tariff-catalog";

/**
 * Dev-only credentials, printed to the console after seeding. Never valid outside a local/dev
 * database — the seed refuses to run against NODE_ENV=production (below).
 */
const DEV_OWNER_EMAIL = "maxime.meyer@cabinet-leman.dev";
const DEV_OWNER_PASSWORD = "ChangeMe123!";

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

  const existingBankAccount = await prisma.bankAccount.findFirst({
    where: { organizationId: organization.id, iban: "CH9300762011623852957" },
  });
  if (!existingBankAccount) {
    await prisma.bankAccount.create({
      data: {
        organizationId: organization.id,
        clinicId: clinic.id,
        label: "Compte principal",
        // Canonical Swiss test IBAN (widely used in SIX documentation examples) — not a QR-IBAN,
        // so invoices from this seed data use referenceType "NON" until a real QR-IBAN is configured.
        iban: "CH9300762011623852957",
        bankName: "Banque Cantonale de Genève",
        currency: "CHF",
        isDefault: true,
      },
    });
  }

  const tariffCatalog =
    (await prisma.tariffCatalog.findFirst({ where: { organizationId: organization.id, system: "SSO_222" } })) ??
    (await prisma.tariffCatalog.create({
      data: {
        organizationId: organization.id,
        name: "Tarif dentaire AA/AM/AI (SSO) — Tarif 222",
        system: "SSO_222",
        description:
          "Catalogue officiel importé depuis l'export hors-ligne fourni par le cabinet (Tarif 222, V2.00 / " +
          "1er janvier 2025, en vigueur depuis le 1er janvier 2018) — voir seed-tariff-catalog.ts.",
      },
    }));

  const tariffVersion =
    (await prisma.tariffVersion.findFirst({ where: { tariffCatalogId: tariffCatalog.id, isActive: true } })) ??
    (await prisma.tariffVersion.create({
      data: {
        tariffCatalogId: tariffCatalog.id,
        versionLabel: "Tarif 222 — V2.00 / 01.01.2025",
        validFrom: new Date("2025-01-01"),
        isActive: true,
      },
    }));

  for (const item of SSO_TARIFF_ITEMS) {
    const description = item.lpComponents ? `${item.description} (inclut ${item.lpComponents})` : item.description;
    const data = {
      description,
      category: item.category,
      points: item.points ?? null,
      pointsPrivateMin: item.pointsPrivateMin ?? null,
      pointsPrivateMax: item.pointsPrivateMax ?? null,
      pointValue: item.manualPrice ? null : 1,
      manualPriceAllowed: item.manualPrice ?? false,
    };
    await prisma.tariffItem.upsert({
      where: { tariffVersionId_code: { tariffVersionId: tariffVersion.id, code: item.code } },
      update: data,
      create: { tariffVersionId: tariffVersion.id, code: item.code, ...data },
    });
  }

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

  const ownerPasswordHash = await bcrypt.hash(DEV_OWNER_PASSWORD, 12);
  const ownerUser = await prisma.user.upsert({
    where: { email: DEV_OWNER_EMAIL },
    update: {},
    create: {
      organizationId: organization.id,
      email: DEV_OWNER_EMAIL,
      passwordHash: ownerPasswordHash,
      name: "Dr Maxime Meyer",
      locale: "fr",
      status: "active",
    },
  });

  await prisma.userClinicAccess.upsert({
    where: { userId_clinicId: { userId: ownerUser.id, clinicId: clinic.id } },
    update: { roleId: ownerRole.id },
    create: { userId: ownerUser.id, clinicId: clinic.id, roleId: ownerRole.id },
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

  const patients = [
    { patientNumber: "2026-0001", firstName: "Léa", lastName: "Rochat", dateOfBirth: new Date("1990-04-12") },
    { patientNumber: "2026-0002", firstName: "Marc", lastName: "Dubois", dateOfBirth: new Date("1978-11-27") },
  ];

  for (const patient of patients) {
    await prisma.patient.upsert({
      where: { clinicId_patientNumber: { clinicId: clinic.id, patientNumber: patient.patientNumber } },
      update: {},
      create: {
        organizationId: organization.id,
        clinicId: clinic.id,
        patientNumber: patient.patientNumber,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        createdBy: ownerUser.id,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded organization "${organization.name}" (${organization.id}).`);
  // eslint-disable-next-line no-console
  console.log(`Dev login: ${DEV_OWNER_EMAIL} / ${DEV_OWNER_PASSWORD} (local/dev only — never real credentials).`);
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
