import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding QR Entry System database...");

  // Clean previous dynamic records for repeatable test state
  await prisma.entryAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.ticket.deleteMany();

  // Upsert Users
  const attendeeUser = await prisma.user.upsert({
    where: { id: "user-attendee-1" },
    update: {
      name: "Arshal",
      email: "arshal@test.local",
      rollNumber: "2025BCY0026",
      role: "AUDIENCE"
    },
    create: {
      id: "user-attendee-1",
      name: "Arshal",
      email: "arshal@test.local",
      rollNumber: "2025BCY0026",
      role: "AUDIENCE"
    }
  });

  const gateStaffUser = await prisma.user.upsert({
    where: { id: "user-gate-1" },
    update: {
      name: "Gate Staff 1",
      email: "gate1@test.local",
      role: "GATE_STAFF"
    },
    create: {
      id: "user-gate-1",
      name: "Gate Staff 1",
      email: "gate1@test.local",
      role: "GATE_STAFF"
    }
  });

  const adminUser = await prisma.user.upsert({
    where: { id: "user-admin-1" },
    update: {
      name: "Admin",
      email: "admin@test.local",
      role: "ADMIN"
    },
    create: {
      id: "user-admin-1",
      name: "Admin",
      email: "admin@test.local",
      role: "ADMIN"
    }
  });

  // Upsert Event
  const event = await prisma.event.upsert({
    where: { id: "event-2026" },
    update: {
      code: "FGL-2026",
      name: "Freshers Got Latent 2026"
    },
    create: {
      id: "event-2026",
      code: "FGL-2026",
      name: "Freshers Got Latent 2026"
    }
  });

  // Upsert Attendee
  const attendee = await prisma.attendee.upsert({
    where: {
      eventId_userId: {
        eventId: "event-2026",
        userId: "user-attendee-1"
      }
    },
    update: {
      registrationStatus: "APPROVED",
      paymentStatus: "VERIFIED"
    },
    create: {
      eventId: "event-2026",
      userId: "user-attendee-1",
      registrationStatus: "APPROVED",
      paymentStatus: "VERIFIED"
    }
  });

  // Upsert Gate
  const gate = await prisma.gate.upsert({
    where: { id: "gate-1" },
    update: {
      eventId: "event-2026",
      name: "Gate 1"
    },
    create: {
      id: "gate-1",
      eventId: "event-2026",
      name: "Gate 1"
    }
  });

  console.log("Database seeded successfully:", {
    users: [attendeeUser.id, gateStaffUser.id, adminUser.id],
    event: event.id,
    attendee: attendee.id,
    gate: gate.id
  });
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
