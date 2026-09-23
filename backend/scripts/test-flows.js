import { PrismaClient } from "@prisma/client";
import { cryptoService } from "../src/services/cryptoService.js";
import { ticketService } from "../src/services/ticketService.js";

const prisma = new PrismaClient();

async function runTests() {
  console.log("\n=======================================================");
  console.log("🧪 RUNNING COMPREHENSIVE BACKEND VERIFICATION FLOWS");
  console.log("=======================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // Reset ticket and attempts for clean run
  await prisma.entryAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.ticket.deleteMany();

  const attendeeUser = await prisma.user.findUnique({ where: { id: "user-attendee-1" } });
  const gateStaffUser = await prisma.user.findUnique({ where: { id: "user-gate-1" } });

  // -------------------------------------------------------------
  // TEST A: Attendee gets pass & Idempotency
  // -------------------------------------------------------------
  console.log("\n--- TEST A: Attendee Pass Generation & Idempotency ---");
  const pass1 = await ticketService.getOrCreateAttendeeTicket({
    userId: attendeeUser.id,
    eventCode: "FGL-2026"
  });

  assert(pass1.ticketId !== null, "Ticket ID exists");
  assert(pass1.status === "ACTIVE", "Ticket status is ACTIVE");
  assert(pass1.qrToken.startsWith("FGL1."), "QR token format starts with FGL1.");
  assert(pass1.attendee.name === "Arshal", "Attendee name matches");

  // Call again -> must return exact same ticket & QR token
  const pass2 = await ticketService.getOrCreateAttendeeTicket({
    userId: attendeeUser.id,
    eventCode: "FGL-2026"
  });

  assert(pass2.ticketId === pass1.ticketId, "Same ticket ID returned on second fetch");
  assert(pass2.qrToken === pass1.qrToken, "Same QR token returned without re-generation");
  const ticketCount = await prisma.ticket.count({ where: { eventId: "event-2026" } });
  assert(ticketCount === 1, "Exactly one ticket exists in database (no duplicates)");

  // -------------------------------------------------------------
  // TEST B: Valid scan by Gate Staff
  // -------------------------------------------------------------
  console.log("\n--- TEST B: Valid Scan by Gate Staff ---");
  const redeemResult1 = await ticketService.redeemTicket({
    qrToken: pass1.qrToken,
    gateId: "gate-1",
    staffUser: gateStaffUser
  });

  assert(redeemResult1.status === 200, "Redeem response HTTP status is 200");
  assert(redeemResult1.data.success === true, "Redeem success is true");
  assert(redeemResult1.data.message === "ENTRY APPROVED", "Message is ENTRY APPROVED");
  assert(redeemResult1.data.attendee.name === "Arshal", "Attendee name in redemption response");

  // Check Database state
  const updatedTicket = await prisma.ticket.findUnique({ where: { id: pass1.ticketId } });
  assert(updatedTicket.status === "REDEEMED", "DB Ticket status transitioned to REDEEMED");
  assert(updatedTicket.redeemedAt !== null, "DB Ticket redeemedAt timestamp is recorded");
  assert(updatedTicket.redeemedBy === "user-gate-1", "DB Ticket redeemedBy is gate staff");
  assert(updatedTicket.redeemedGateId === "gate-1", "DB Ticket redeemedGateId is gate-1");

  // Check EntryAttempt log
  const approvedAttempt = await prisma.entryAttempt.findFirst({
    where: { ticketId: pass1.ticketId, result: "ENTRY_APPROVED" }
  });
  assert(approvedAttempt !== null, "EntryAttempt logged with result ENTRY_APPROVED");

  // -------------------------------------------------------------
  // TEST C: Replay same QR
  // -------------------------------------------------------------
  console.log("\n--- TEST C: Replay Protection (Second Scan) ---");
  const replayResult = await ticketService.redeemTicket({
    qrToken: pass1.qrToken,
    gateId: "gate-1",
    staffUser: gateStaffUser
  });

  assert(replayResult.status === 400, "Replay response HTTP status is 400");
  assert(replayResult.data.success === false, "Replay success is false");
  assert(replayResult.data.message === "PASS ALREADY USED", "Replay message is PASS ALREADY USED");

  const replayAttempt = await prisma.entryAttempt.findFirst({
    where: { ticketId: pass1.ticketId, result: "ALREADY_REDEEMED" }
  });
  assert(replayAttempt !== null, "EntryAttempt logged with result ALREADY_REDEEMED");

  // -------------------------------------------------------------
  // TEST D: Tamper with QR Token
  // -------------------------------------------------------------
  console.log("\n--- TEST D: Tampered QR Token ---");
  // Replace a character in the signature or payload
  const parts = pass1.qrToken.split(".");
  const tamperedPayload = parts[1].substring(0, parts[1].length - 1) + (parts[1].endsWith("A") ? "B" : "A");
  const tamperedToken = `FGL1.${tamperedPayload}.${parts[2]}`;

  const tamperedResult = await ticketService.redeemTicket({
    qrToken: tamperedToken,
    gateId: "gate-1",
    staffUser: gateStaffUser
  });

  assert(tamperedResult.status === 400, "Tampered QR HTTP status is 400");
  assert(tamperedResult.data.success === false, "Tampered QR success is false");
  assert(tamperedResult.data.message === "INVALID QR", "Tampered QR message is INVALID QR");

  // -------------------------------------------------------------
  // TEST E: Wrong Event QR Token
  // -------------------------------------------------------------
  console.log("\n--- TEST E: Wrong Event QR Token ---");
  const wrongEventSigned = cryptoService.signQrPayload({
    eventCode: "OTHER-EVENT-999",
    ticketCode: cryptoService.generateTicketCode(),
    nonce: cryptoService.generateNonce(32),
    issuedAt: new Date()
  });

  const wrongEventResult = await ticketService.redeemTicket({
    qrToken: wrongEventSigned.qrToken,
    gateId: "gate-1",
    staffUser: gateStaffUser
  });

  assert(wrongEventResult.status === 400, "Wrong event QR HTTP status is 400");
  assert(wrongEventResult.data.success === false, "Wrong event success is false");
  assert(wrongEventResult.data.message === "WRONG EVENT", "Wrong event message is WRONG EVENT");

  console.log("\n=======================================================");
  console.log(`🎉 ALL TESTS PASSED! (${passed}/${total} assertions)`);
  console.log("=======================================================\n");
}

runTests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
