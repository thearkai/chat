// ==========================================================
//  Multer upload middleware with file-type & size validation
// ==========================================================
import multer from "multer";
import path from "path";
import fs from "fs";
import { env } from "../config/env.js";

const uploadDir = env.uploads.dir;
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = {
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/html": ".html",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "video/mp4": ".mp4",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
  },
});

function fileFilter(req, file, cb) {
  if (ALLOWED[file.mimetype]) return cb(null, true);
  cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, TXT, HTML, PNG, JPG, MP4.`));
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.uploads.maxFileSizeMb * 1024 * 1024 },
});
