import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { aiLimiter } from "../middleware/rateLimiter.js";
import { upload } from "../middleware/upload.js";
import { uploadAndAnalyze } from "../controllers/uploadController.js";

const router = Router();

router.post("/", aiLimiter, optionalAuth, upload.single("file"), uploadAndAnalyze);

export default router;
