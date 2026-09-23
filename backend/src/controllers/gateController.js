import { ticketService } from "../services/ticketService.js";
import prisma from "../lib/prisma.js";

/**
 * POST /api/gate/redeem
 * Body: { qr_token: "FGL1...", gate_id: "gate-1" }
 */
export async function redeemGatePass(req, res) {
  try {
    const qrToken = req.body.qr_token || req.body.qrToken;
    const gateId = req.body.gate_id || req.body.gateId || "gate-1";
    const deviceId = req.body.device_id || req.body.deviceId || req.headers["x-device-id"] || null;
    const staffUser = req.user;

    if (!qrToken) {
      return res.status(400).json({
        success: false,
        message: "INVALID QR: qr_token is required"
      });
    }

    const result = await ticketService.redeemTicket({
      qrToken: String(qrToken).trim(),
      gateId: String(gateId).trim(),
      staffUser,
      deviceId
    });

    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error("redeemGatePass error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error during gate redemption"
    });
  }
}

/**
 * GET /api/gate/gates
 * List available gates for the current event
 */
export async function listGates(req, res) {
  try {
    const gates = await prisma.gate.findMany({
      include: { event: true }
    });
    return res.status(200).json({ success: true, gates });
  } catch (err) {
    console.error("listGates error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
