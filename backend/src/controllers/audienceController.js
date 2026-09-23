import { ticketService } from "../services/ticketService.js";

/**
 * GET /api/audience/pass
 * Returns the attendee's ticket and signed QR token (creates ticket idempotently if not already issued)
 */
export async function getAudiencePass(req, res) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User session required"
      });
    }

    const eventCode = req.query.eventCode || "FGL-2026";
    const passData = await ticketService.getOrCreateAttendeeTicket({
      userId: user.id,
      eventCode
    });

    return res.status(200).json({
      success: true,
      ticketId: passData.ticketId,
      ticketCode: passData.ticketCode,
      status: passData.status,
      issuedAt: passData.issuedAt,
      redeemedAt: passData.redeemedAt,
      expiresAt: passData.expiresAt,
      qrToken: passData.qrToken,
      event: passData.event,
      attendee: {
        name: passData.attendee.name,
        rollNumber: passData.attendee.rollNumber
      }
    });
  } catch (err) {
    console.error("getAudiencePass error:", err);
    return res.status(400).json({
      success: false,
      message: err.message || "Unable to retrieve audience pass"
    });
  }
}
