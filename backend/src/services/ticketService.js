import prisma from "../lib/prisma.js";
import { cryptoService } from "./cryptoService.js";
import { auditService } from "./auditService.js";

/**
 * Retrieve an existing active ticket for the attendee or issue exactly one if approved & paid.
 */
export async function getOrCreateAttendeeTicket({ userId, eventCode = "FGL-2026" }) {
  const event = await prisma.event.findUnique({
    where: { code: eventCode }
  });

  if (!event) {
    throw new Error(`Event with code ${eventCode} not found`);
  }

  const attendee = await prisma.attendee.findUnique({
    where: {
      eventId_userId: {
        eventId: event.id,
        userId
      }
    },
    include: {
      user: true,
      ticket: true
    }
  });

  if (!attendee) {
    throw new Error("Attendee registration not found for this event");
  }

  // Check if existing ticket is already issued
  let ticket = attendee.ticket;

  if (!ticket) {
    // Only approved registration and verified payment can receive a ticket
    if (attendee.registrationStatus !== "APPROVED") {
      throw new Error(`Registration is not approved (Current: ${attendee.registrationStatus})`);
    }

    if (attendee.paymentStatus !== "VERIFIED") {
      throw new Error(`Payment is not verified (Current: ${attendee.paymentStatus})`);
    }

    // Generate cryptographic tokens
    const ticketCode = cryptoService.generateTicketCode();
    const nonce = cryptoService.generateNonce(32);

    ticket = await prisma.ticket.create({
      data: {
        eventId: event.id,
        attendeeId: attendee.id,
        ticketCode,
        nonce,
        status: "ACTIVE",
        signingKeyId: process.env.QR_SIGNING_KEY_ID || "FGL-2026-01"
      }
    });

    await auditService.logAuditEvent({
      eventId: event.id,
      entityId: ticket.id,
      action: "TICKET_CREATED",
      actorId: userId,
      metadata: { ticketCode: ticket.ticketCode }
    });
  }

  // Generate signed QR token
  const { qrToken } = cryptoService.signQrPayload({
    eventCode: event.code,
    ticketCode: ticket.ticketCode,
    nonce: ticket.nonce,
    issuedAt: ticket.issuedAt,
    kid: ticket.signingKeyId
  });

  await auditService.logAuditEvent({
    eventId: event.id,
    entityId: ticket.id,
    action: "PASS_VIEWED",
    actorId: userId
  });

  return {
    ticketId: ticket.id,
    ticketCode: ticket.ticketCode,
    status: ticket.status,
    issuedAt: ticket.issuedAt,
    redeemedAt: ticket.redeemedAt,
    expiresAt: ticket.expiresAt,
    qrToken,
    event: {
      id: event.id,
      code: event.code,
      name: event.name
    },
    attendee: {
      id: attendee.id,
      name: attendee.user.name,
      email: attendee.user.email,
      rollNumber: attendee.user.rollNumber,
      registrationStatus: attendee.registrationStatus,
      paymentStatus: attendee.paymentStatus
    }
  };
}

/**
 * Redeem ticket at gate with complete 16-step validation and atomic database update
 */
export async function redeemTicket({ qrToken, gateId, staffUser, deviceId = null }) {
  const staffId = staffUser?.id || null;

  // 1. Authenticate gate staff
  if (!staffUser || (staffUser.role !== "GATE_STAFF" && staffUser.role !== "ADMIN")) {
    await auditService.logEntryAttempt({
      eventId: "event-2026",
      gateId,
      staffId,
      result: "UNAUTHORIZED",
      failureReason: "Staff user not authorized for gate redemption",
      deviceId
    });
    return {
      status: 403,
      data: { success: false, message: "UNAUTHORIZED STAFF" }
    };
  }

  // 2. Check gate exists & permission
  const gate = await prisma.gate.findUnique({
    where: { id: gateId },
    include: { event: true }
  });

  if (!gate) {
    await auditService.logEntryAttempt({
      eventId: "event-2026",
      gateId,
      staffId,
      result: "UNAUTHORIZED",
      failureReason: `Gate ${gateId} not found`,
      deviceId
    });
    return {
      status: 404,
      data: { success: false, message: "GATE NOT FOUND" }
    };
  }

  // 3 & 4 & 5. Parse QR token, validate structure, and verify Ed25519 signature
  const verification = cryptoService.verifyQrToken(qrToken);

  if (!verification.valid) {
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      gateId,
      staffId,
      result: "INVALID_SIGNATURE",
      failureReason: verification.error,
      deviceId,
      metadata: { qrToken }
    });

    await auditService.logAuditEvent({
      eventId: gate.eventId,
      action: "ENTRY_REJECTED",
      actorId: staffId,
      gateId,
      deviceId,
      metadata: { reason: "INVALID_SIGNATURE", error: verification.error }
    });

    return {
      status: 400,
      data: { success: false, message: "INVALID QR", error: verification.error }
    };
  }

  const { eventCode, ticketCode, nonce } = verification.payload;

  // 6. Check event code match
  if (eventCode !== gate.event.code) {
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      gateId,
      staffId,
      result: "WRONG_EVENT",
      failureReason: `Token event code ${eventCode} does not match gate event ${gate.event.code}`,
      deviceId
    });

    await auditService.logAuditEvent({
      eventId: gate.eventId,
      action: "ENTRY_REJECTED",
      actorId: staffId,
      gateId,
      metadata: { reason: "WRONG_EVENT", eventCode }
    });

    return {
      status: 400,
      data: { success: false, message: "WRONG EVENT" }
    };
  }

  // 7 & 8. Find ticket and check existence
  const ticket = await prisma.ticket.findFirst({
    where: {
      ticketCode,
      eventId: gate.eventId
    },
    include: {
      attendee: {
        include: { user: true }
      },
      gate: true
    }
  });

  if (!ticket) {
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      gateId,
      staffId,
      result: "UNKNOWN_TICKET",
      failureReason: `Ticket ${ticketCode} not found in database`,
      deviceId
    });

    await auditService.logAuditEvent({
      eventId: gate.eventId,
      action: "ENTRY_REJECTED",
      actorId: staffId,
      gateId,
      metadata: { reason: "UNKNOWN_TICKET", ticketCode }
    });

    return {
      status: 404,
      data: { success: false, message: "INVALID QR" }
    };
  }

  // 9. Check nonce
  if (ticket.nonce !== nonce) {
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      ticketId: ticket.id,
      gateId,
      staffId,
      result: "INVALID_SIGNATURE",
      failureReason: "Nonce mismatch with ticket in database",
      deviceId
    });

    return {
      status: 400,
      data: { success: false, message: "INVALID QR" }
    };
  }

  // 10. Check ticket status (Already redeemed, revoked, blocked, expired)
  if (ticket.status === "REDEEMED") {
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      ticketId: ticket.id,
      gateId,
      staffId,
      result: "ALREADY_REDEEMED",
      failureReason: "Ticket already redeemed",
      deviceId
    });

    await auditService.logAuditEvent({
      eventId: gate.eventId,
      entityId: ticket.id,
      action: "ENTRY_REJECTED",
      actorId: staffId,
      gateId,
      metadata: { reason: "ALREADY_REDEEMED", firstRedemption: ticket.redeemedAt }
    });

    return {
      status: 400,
      data: {
        success: false,
        message: "PASS ALREADY USED",
        details: {
          firstEntry: ticket.redeemedAt,
          gate: ticket.gate?.name || ticket.redeemedGateId
        }
      }
    };
  }

  if (ticket.status === "BLOCKED") {
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      ticketId: ticket.id,
      gateId,
      staffId,
      result: "BLOCKED",
      failureReason: "Ticket is blocked",
      deviceId
    });
    return { status: 400, data: { success: false, message: "TICKET BLOCKED" } };
  }

  if (ticket.status === "REVOKED") {
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      ticketId: ticket.id,
      gateId,
      staffId,
      result: "REVOKED",
      failureReason: "Ticket is revoked",
      deviceId
    });
    return { status: 400, data: { success: false, message: "TICKET REVOKED" } };
  }

  if (ticket.status === "EXPIRED" || (ticket.expiresAt && new Date() > ticket.expiresAt)) {
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      ticketId: ticket.id,
      gateId,
      staffId,
      result: "EXPIRED",
      failureReason: "Ticket is expired",
      deviceId
    });
    return { status: 400, data: { success: false, message: "TICKET EXPIRED" } };
  }

  // 11. Check registration status
  if (ticket.attendee.registrationStatus !== "APPROVED") {
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      ticketId: ticket.id,
      gateId,
      staffId,
      result: "REGISTRATION_NOT_APPROVED",
      failureReason: `Attendee status is ${ticket.attendee.registrationStatus}`,
      deviceId
    });
    return { status: 400, data: { success: false, message: "REGISTRATION NOT APPROVED" } };
  }

  // 12. Check payment status
  if (ticket.attendee.paymentStatus !== "VERIFIED") {
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      ticketId: ticket.id,
      gateId,
      staffId,
      result: "PAYMENT_NOT_VERIFIED",
      failureReason: `Attendee payment is ${ticket.attendee.paymentStatus}`,
      deviceId
    });
    return { status: 400, data: { success: false, message: "PAYMENT NOT VERIFIED" } };
  }

  // 13 & 14 & 15 & 16. Atomic Redemption
  const now = new Date();
  const rawUpdatedRows = await prisma.$queryRaw`
    UPDATE "Ticket"
    SET
      "status" = 'REDEEMED'::"TicketStatus",
      "redeemedAt" = ${now},
      "redeemedBy" = ${staffId},
      "redeemedGateId" = ${gateId},
      "updatedAt" = ${now}
    WHERE
      "id" = ${ticket.id}
      AND "eventId" = ${gate.eventId}
      AND "status" = 'ACTIVE'::"TicketStatus"
    RETURNING "id", "redeemedAt", "status";
  `;

  if (!rawUpdatedRows || rawUpdatedRows.length === 0) {
    // Another concurrent transaction redeemed the ticket in the millisecond between read and update
    await auditService.logEntryAttempt({
      eventId: gate.eventId,
      ticketId: ticket.id,
      gateId,
      staffId,
      result: "ALREADY_REDEEMED",
      failureReason: "Concurrent redemption attempt; atomic update matched 0 active rows",
      deviceId
    });

    await auditService.logAuditEvent({
      eventId: gate.eventId,
      entityId: ticket.id,
      action: "ENTRY_REJECTED",
      actorId: staffId,
      gateId,
      metadata: { reason: "CONCURRENT_ALREADY_REDEEMED" }
    });

    return {
      status: 400,
      data: { success: false, message: "PASS ALREADY USED" }
    };
  }

  // Entry confirmed!
  await auditService.logEntryAttempt({
    eventId: gate.eventId,
    ticketId: ticket.id,
    gateId,
    staffId,
    result: "ENTRY_APPROVED",
    deviceId
  });

  await auditService.logAuditEvent({
    eventId: gate.eventId,
    entityId: ticket.id,
    action: "ENTRY_CONFIRMED",
    actorId: staffId,
    gateId,
    deviceId
  });

  return {
    status: 200,
    data: {
      success: true,
      message: "ENTRY APPROVED",
      attendee: {
        name: ticket.attendee.user.name,
        rollNumber: ticket.attendee.user.rollNumber || "N/A"
      },
      gate: gate.name,
      entryTime: now.toISOString()
    }
  };
}

export const ticketService = {
  getOrCreateAttendeeTicket,
  redeemTicket
};

export default ticketService;
