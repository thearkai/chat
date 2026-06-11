// ==========================================================
//  Global error handler & 404 handler
// ==========================================================
import { logger } from "../utils/logger.js";
import { fail } from "../utils/apiResponse.js";

export function notFound(req, res) {
  return fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

export function errorHandler(err, req, res, next) {
  logger.error(err.stack || err.message || err);

  // Multer file-size error
  if (err.code === "LIMIT_FILE_SIZE") {
    return fail(res, "File is too large. Please upload a smaller file.", 413);
  }
  if (err.message && err.message.includes("Unsupported file type")) {
    return fail(res, err.message, 415);
  }

  return fail(res, err.message || "Internal server error.", err.status || 500);
}
