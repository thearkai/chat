// ==========================================================
//  Upload controller – store file + analyse with Gemini
// ==========================================================
import fs from "fs";
import path from "path";
import { ok, fail } from "../utils/apiResponse.js";
import { sanitize } from "../utils/validators.js";
import { analyzeFile, aiReady } from "../services/aiService.js";
import { cloudinary, cloudinaryEnabled } from "../config/cloudinary.js";

// POST /api/upload  (optionalAuth, multipart) – upload + analyse
export async function uploadAndAnalyze(req, res, next) {
  try {
    if (!req.file) return fail(res, "No file uploaded.", 400);

    const { path: filePath, mimetype, originalname, size } = req.file;
    const prompt = sanitize(req.body.prompt) || "";

    let url = `/uploads/${path.basename(filePath)}`;

    // Optional Cloudinary upload for images/videos
    if (cloudinaryEnabled && /^image|^video/.test(mimetype)) {
      try {
        const result = await cloudinary.uploader.upload(filePath, {
          resource_type: mimetype.startsWith("video") ? "video" : "image",
          folder: "the-ark-ai",
        });
        url = result.secure_url;
      } catch (e) {
        // fall back to local url silently
      }
    }

    let analysis = null;
    if (aiReady) {
      analysis = await analyzeFile({ filePath, mimeType: mimetype, prompt });
    }

    return ok(
      res,
      {
        file: { name: originalname, mimeType: mimetype, size, url },
        analysis,
      },
      "File uploaded and analysed."
    );
  } catch (e) {
    next(e);
  }
}
