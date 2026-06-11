// ==========================================================
//  Unified AI router
//  - Chat / streaming  -> configured provider (deepseek | gemini)
//  - File analysis:
//      * text / html / pdf  -> primary provider (text)
//      * images / video     -> Gemini (vision); else friendly message
// ==========================================================
import fs from "fs";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

import * as gemini from "./geminiService.js";
import * as deepseek from "./deepseekService.js";
import * as oai from "./openaiCompatService.js";

// Normalise provider name. "openrouter" and "deepseek" both use the
// OpenAI-compatible service; "gemini" uses the native Gemini SDK.
const raw = env.aiProvider;
const provider =
  raw === "openrouter" || raw === "openai" ? "openrouter"
  : raw === "deepseek" ? "deepseek"
  : "gemini";

// The text providers (openrouter/deepseek) both run through oai service.
const usesOai = provider === "openrouter" || provider === "deepseek";

// Is the primary chat provider ready?
export const aiReady = usesOai ? oai.openaiCompatReady : gemini.geminiReady;

export const activeProvider = provider;
export const visionAvailable = gemini.geminiReady; // only Gemini can see images

// ---- Chat ----
export async function generateReply(message, history = []) {
  if (usesOai) return oai.generateReply(message, history);
  return gemini.generateReply(message, history);
}

export async function* streamReply(message, history = []) {
  if (usesOai) {
    yield* oai.streamReply(message, history);
  } else {
    yield* gemini.streamReply(message, history);
  }
}

// ---- File analysis ----
export async function analyzeFile({ filePath, mimeType, prompt }) {
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");

  // Images & video need a vision model (Gemini only)
  if (isImage || isVideo) {
    if (gemini.geminiReady) {
      return gemini.analyzeFile({ filePath, mimeType, prompt });
    }
    return (
      "⚠️ I can't analyse images or videos right now — the current AI model is text-only. " +
      "To enable image/video understanding, add a Gemini API key (GEMINI_API_KEY) on the server. " +
      "You can still upload PDF, TXT and HTML documents for analysis."
    );
  }

  // Text-like + PDF: extract text, then send to the primary provider
  let text = "";
  try {
    if (mimeType === "text/plain" || mimeType === "text/html") {
      text = fs.readFileSync(filePath, "utf-8").slice(0, 100000);
    } else if (mimeType === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(fs.readFileSync(filePath));
      text = (data.text || "").slice(0, 100000);
    }
  } catch (e) {
    logger.warn("Text extraction failed:", e.message);
  }

  if (!text) {
    // Fall back to Gemini's native handling if available
    if (gemini.geminiReady) return gemini.analyzeFile({ filePath, mimeType, prompt });
    return "⚠️ Could not read this file's contents for analysis.";
  }

  if (usesOai) return oai.analyzeText(text, prompt);
  // gemini path
  return gemini.analyzeFile({ filePath, mimeType, prompt });
}
