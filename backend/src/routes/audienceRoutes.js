import { Router } from "express";
import { getAudiencePass } from "../controllers/audienceController.js";
import { requireDevAuth } from "../lib/authMiddleware.js";

const router = Router();

router.get("/pass", requireDevAuth, getAudiencePass);

export default router;
