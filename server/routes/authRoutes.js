import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  syncProfile,
  validateRegistrationFields,
  me,
} from "../controllers/authController.js";

const router = Router();

router.post("/validate-registration", validateRegistrationFields);
router.post("/sync", requireAuth, syncProfile);
router.get("/me", requireAuth, me);

export default router;
