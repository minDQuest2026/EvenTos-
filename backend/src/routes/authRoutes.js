import { Router } from "express";
import { devLogin, listDevUsers } from "../controllers/authController.js";

const router = Router();

router.post("/login", devLogin);
router.get("/users", listDevUsers);

export default router;
