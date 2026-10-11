// prisma/seed.js — fictional seed data for local development.
// Run with: npm run db:seed

const { PrismaClient, Prisma } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const PASSWORD = "test123";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const [hospital, ambulance, clinic] = await Promise.all([
    prisma.organization.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: "City Hospital",
        type: "hospital",
      },
    }),
    prisma.organization.upsert({
      where: { id: 2 },
      update: {},
      create: {
        id: 2,
        name: "Ambulance South",
        type: "ambulance service",
      },
    }),
    // The clinic is an organization its staff belong to. It grants no extra
    // clinical permission — see src/lib/auth/permissions.ts.
    prisma.organization.upsert({
      where: { id: 3 },
      update: {},
      create: {
        id: 3,
        name: "Ekfors Primary Care Centre",
        type: "clinic",
      },
    }),
  ]);

  const users = [
    {
      id: 1,
      username: "dr_test",
      role: "doctor",
      organizationId: hospital.id,
    },
    {
      id: 2,
      username: "nurse_test",
      role: "nurse",
      organizationId: hospital.id,
    },
    {
      id: 3,
      username: "amb_test",
      role: "ambulance",
      organizationId: ambulance.id,
    },
    {
      id: 4,
      username: "patient_test",
      role: "patient",
      organizationId: null,
    },
    {
      id: 5,
      username: "unauth_test",
      role: "unauthorized",
      organizationId: null,
    },
    {
      id: 6,
      username: "vc_test",
      role: "primary_care",
      organizationId: clinic.id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        ...user,
        passwordHash,
      },
    });
  }

  const patient = await prisma.patient.upsert({
    where: { id: 1 },
    update: { userId: 4, firstName: "Anna", lastName: "Kowalska" },
    create: {
      id: 1,
      personalNumber: "199001011234",
      firstName: "Anna",
      lastName: "Kowalska",
      dateOfBirth: new Date("1990-01-01"),
      userId: 4,
    },
  });

  // A second patient so e2e can assert patients cannot open other patients' notes.
  const otherPatient = await prisma.patient.upsert({
    where: { id: 2 },
    update: { firstName: "Mark", lastName: "Thompson" },
    create: {
      id: 2,
      personalNumber: "199207225678",
      firstName: "Mark",
      lastName: "Thompson",
      dateOfBirth: new Date("1992-07-22"),
    },
  });

  const record = await prisma.medicalRecord.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      recordType: "diagnosis",
      content: "Mild asthma — inhaler prescribed.",
      patientId: patient.id,
      authorId: 1,
    },
  });

  await prisma.medicalRecord.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      recordType: "diagnosis",
      content: "Mark's record — private to patient 2.",
      patientId: otherPatient.id,
      authorId: 1,
    },
  });

  // Healthcare note — visible to healthcare staff.
  await prisma.note.upsert({
    where: { id: 1 },
    update: {
      content: "Follow-up in six months.",
      visibility: "healthcare",
      recordId: record.id,
      authorId: 2,
    },
    create: {
      id: 1,
      content: "Follow-up in six months.",
      visibility: "healthcare",
      recordId: record.id,
      authorId: 2,
    },
  });

  // Private note — only visible to its author (doctor, user 1).
  await prisma.note.upsert({
    where: { id: 2 },
    update: {
      content: "Private doctor note.",
      visibility: "private",
      recordId: record.id,
      authorId: 1,
    },
    create: {
      id: 2,
      content: "Private doctor note.",
      visibility: "private",
      recordId: record.id,
      authorId: 1,
    },
  });

  // Public-to-authorized-users note — patient can see this.
  await prisma.note.upsert({
    where: { id: 3 },
    update: {
      content: "Visible to everyone with journal access.",
      visibility: "all",
      recordId: record.id,
      authorId: 2,
    },
    create: {
      id: 3,
      content: "Visible to everyone with journal access.",
      visibility: "all",
      recordId: record.id,
      authorId: 2,
    },
  });

  // Keep the PostgreSQL autoincrement sequences above the manually seeded IDs.
  for (const table of ["patients", "medical_records", "notes"]) {
    await prisma.$queryRaw(Prisma.sql`
      SELECT setval(
        pg_get_serial_sequence(${Prisma.raw(`'${table}'`)}, 'id'),
        COALESCE((SELECT MAX(id) FROM ${Prisma.raw(table)}), 1),
        true
      )
    `);
  }

  console.log("Seeded organizations, users (pw: test123), patients, records + notes.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
