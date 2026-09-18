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

  const rooms = ["Salle 1", "Salle 2"];
  for (const roomName of rooms) {
    const existingRoom = await prisma.room.findFirst({ where: { clinicId: clinic.id, name: roomName } });
    if (!existingRoom) {
      await prisma.room.create({ data: { clinicId: clinic.id, name: roomName } });
    }
  }

  // Appointment types (agenda "types de rendez-vous configurables" — section ÉTAPE 1.3): each
  // carries a display color and a default duration the booking modal pre-fills (still editable per
  // appointment). Colors chosen to stay visually distinct from one another in the calendar grid.
  const appointmentTypes: { name: string; color: string; defaultDurationMinutes: number }[] = [
    { name: "Consultation", color: "#2563EB", defaultDurationMinutes: 30 },
    { name: "Contrôle", color: "#0891B2", defaultDurationMinutes: 20 },
    { name: "Détartrage", color: "#059669", defaultDurationMinutes: 45 },
    { name: "Soins", color: "#65A30D", defaultDurationMinutes: 45 },
    { name: "Endodontie", color: "#7C3AED", defaultDurationMinutes: 60 },
    { name: "Prothèse", color: "#D97706", defaultDurationMinutes: 60 },
    { name: "Chirurgie", color: "#DC2626", defaultDurationMinutes: 60 },
    { name: "Implantologie", color: "#9333EA", defaultDurationMinutes: 90 },
    { name: "Urgence", color: "#E11D48", defaultDurationMinutes: 30 },
    { name: "Orthodontie", color: "#0D9488", defaultDurationMinutes: 30 },
  ];
  for (const type of appointmentTypes) {
    const existingType = await prisma.appointmentType.findFirst({ where: { clinicId: clinic.id, name: type.name } });
    if (existingType) {
      await prisma.appointmentType.update({
        where: { id: existingType.id },
        data: { color: type.color, defaultDurationMinutes: type.defaultDurationMinutes },
      });
    } else {
      await prisma.appointmentType.create({
        data: {
          clinicId: clinic.id,
          name: type.name,
          color: type.color,
          defaultDurationMinutes: type.defaultDurationMinutes,
        },
      });
    }
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

  const [meyer, martin] = await Promise.all([
    prisma.practitioner.findFirstOrThrow({ where: { clinicId: clinic.id, lastName: "Meyer" } }),
    prisma.practitioner.findFirstOrThrow({ where: { clinicId: clinic.id, lastName: "Martin" } }),
  ]);
  const [rochat, dubois] = await Promise.all([
    prisma.patient.findFirstOrThrow({ where: { clinicId: clinic.id, patientNumber: "2026-0001" } }),
    prisma.patient.findFirstOrThrow({ where: { clinicId: clinic.id, patientNumber: "2026-0002" } }),
  ]);
  const [salle1, salle2] = await Promise.all([
    prisma.room.findFirstOrThrow({ where: { clinicId: clinic.id, name: "Salle 1" } }),
    prisma.room.findFirstOrThrow({ where: { clinicId: clinic.id, name: "Salle 2" } }),
  ]);
  const typeByName = new Map(
    (await prisma.appointmentType.findMany({ where: { clinicId: clinic.id } })).map((t) => [t.name, t.id]),
  );

  function todayAt(hour: number, minute: number): Date {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  const sampleAppointments: {
    practitionerId: string;
    patientId: string;
    roomId: string;
    typeName: string;
    startAt: Date;
    endAt: Date;
  }[] = [
    { practitionerId: meyer.id, patientId: rochat.id, roomId: salle1.id, typeName: "Contrôle", startAt: todayAt(8, 30), endAt: todayAt(8, 50) },
    { practitionerId: meyer.id, patientId: dubois.id, roomId: salle1.id, typeName: "Détartrage", startAt: todayAt(9, 30), endAt: todayAt(10, 15) },
    { practitionerId: martin.id, patientId: rochat.id, roomId: salle2.id, typeName: "Orthodontie", startAt: todayAt(10, 0), endAt: todayAt(10, 30) },
    { practitionerId: meyer.id, patientId: dubois.id, roomId: salle1.id, typeName: "Consultation", startAt: todayAt(14, 0), endAt: todayAt(14, 30) },
  ];

  for (const appt of sampleAppointments) {
    const existing = await prisma.appointment.findFirst({
      where: { clinicId: clinic.id, practitionerId: appt.practitionerId, startAt: appt.startAt },
    });
    if (existing) continue;
    await prisma.appointment.create({
      data: {
        organizationId: organization.id,
        clinicId: clinic.id,
        patientId: appt.patientId,
        practitionerId: appt.practitionerId,
        roomId: appt.roomId,
        appointmentTypeId: typeByName.get(appt.typeName),
        startAt: appt.startAt,
        endAt: appt.endAt,
        status: "confirmed",
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
