import { Router } from "express";
import { redeemGatePass, listGates } from "../controllers/gateController.js";
import { requireDevAuth } from "../lib/authMiddleware.js";

const router = Router();

router.post("/redeem", requireDevAuth, redeemGatePass);
router.get("/gates", listGates);

export default router;
