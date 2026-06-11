import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { aiLimiter } from "../middleware/rateLimiter.js";
import { capabilities, createFile } from "../controllers/generateController.js";

const router = Router();

router.get("/capabilities", capabilities);
router.post("/file", aiLimiter, optionalAuth, createFile);

export default router;
