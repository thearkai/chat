// ==========================================================
//  Generate controller
//  - POST /api/generate/file : package provided content into
//    a downloadable file (docx, pdf, txt, md, html, code...).
//  - GET  /api/generate/capabilities : what we can produce.
// ==========================================================
import { ok, fail } from "../utils/apiResponse.js";
import { sanitize } from "../utils/validators.js";
import { generateFile, CAPABILITIES } from "../services/fileService.js";

export function capabilities(req, res) {
  return ok(res, { capabilities: CAPABILITIES });
}

export async function createFile(req, res, next) {
  try {
    const { content, format, language } = req.body || {};
    const baseName = sanitize(req.body.baseName) || "the-ark-ai";
    const title = sanitize(req.body.title) || "The Ark AI Document";

    if (!content || typeof content !== "string" || !content.trim())
      return fail(res, "No content provided to generate a file.", 422);

    if (content.length > 200000)
      return fail(res, "Content too large to package (200k char limit).", 413);

    const result = await generateFile({ content, format, language, baseName, title });
    return ok(res, { file: result }, "File generated.");
  } catch (e) {
    next(e);
  }
}
