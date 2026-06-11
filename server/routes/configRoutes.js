import { Router } from "express";
import { ok } from "../utils/apiResponse.js";
import { env } from "../config/env.js";
import { firebaseEnabled } from "../config/firebase.js";
import { aiReady, activeProvider, visionAvailable } from "../services/aiService.js";

const router = Router();

// GET /api/config – public client config (Firebase web keys are public by design)
router.get("/", (req, res) => {
  return ok(res, {
    firebase: env.firebaseWeb,
    features: {
      firebaseEnabled,
      aiReady,
      geminiReady: aiReady, // kept for backwards compatibility with the client
      provider: activeProvider,
      visionAvailable, // can the app analyse images/video?
      cloudinary: env.cloudinary.enabled,
    },
    maxFileSizeMb: env.uploads.maxFileSizeMb,
  });
});

export default router;
