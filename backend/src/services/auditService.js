import prisma from "../lib/prisma.js";

/**
 * Log an entry attempt (both approved and rejected attempts)
 */
export async function logEntryAttempt({
  eventId,
  ticketId = null,
  gateId = null,
  staffId = null,
  result,
  failureReason = null,
  deviceId = null,
  metadata = null
}) {
  try {
    return await prisma.entryAttempt.create({
      data: {
        eventId,
        ticketId,
        gateId,
        staffId,
        result,
        failureReason,
        deviceId,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
      }
    });
  } catch (err) {
    console.error("Failed to log EntryAttempt:", err);
    return null;
  }
}

/**
 * Log a general audit event
 */
export async function logAuditEvent({
  eventId = null,
  entityId = null,
  action,
  actorId = null,
  gateId = null,
  deviceId = null,
  metadata = null
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        eventId,
        entityId,
        action,
        actorId,
        gateId,
        deviceId,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
      }
    });
  } catch (err) {
    console.error("Failed to log AuditLog:", err);
    return null;
  }
}

export const auditService = {
  logEntryAttempt,
  logAuditEvent
};

export default auditService;
