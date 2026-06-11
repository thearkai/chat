// ==========================================================
//  Google Gemini AI service
//  Handles chat, streaming and multimodal (file) analysis.
// ==========================================================
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";

let genAI = null;
if (env.gemini.apiKey) {
  genAI = new GoogleGenerativeAI(env.gemini.apiKey);
}


function getModel() {
  if (!genAI) throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in .env.");
  return genAI.getGenerativeModel({
    model: env.gemini.model,
    systemInstruction: SYSTEM_PROMPT,
  });
}

// Convert our message history -> Gemini "contents" format
function toGeminiHistory(history = []) {
  return history
    .filter((m) => m && m.content)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content) }],
    }));
}

// ---- Standard (non-streamed) chat ----
export async function generateReply(message, history = []) {
  const model = getModel();
  const chat = model.startChat({ history: toGeminiHistory(history) });
  const result = await chat.sendMessage(message);
  return result.response.text();
}

// ---- Streaming chat (yields text chunks) ----
export async function* streamReply(message, history = []) {
  const model = getModel();
  const chat = model.startChat({ history: toGeminiHistory(history) });
  const result = await chat.sendMessageStream(message);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

// ---- Multimodal file analysis ----
export async function analyzeFile({ filePath, mimeType, prompt }) {
  const model = getModel();

  // Text-like files: read and inline as text
  if (mimeType === "text/plain" || mimeType === "text/html") {
    const text = fs.readFileSync(filePath, "utf-8").slice(0, 100000);
    const result = await model.generateContent(
      `${prompt || "Analyse and summarise this document."}\n\n--- FILE CONTENT ---\n${text}`
    );
    return result.response.text();
  }

  // PDF: extract text with pdf-parse
  if (mimeType === "application/pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      const text = (data.text || "").slice(0, 100000);
      const result = await model.generateContent(
        `${prompt || "Analyse and summarise this PDF."}\n\n--- PDF TEXT ---\n${text}`
      );
      return result.response.text();
    } catch (e) {
      logger.warn("pdf-parse failed, sending as inline data:", e.message);
    }
  }

  // Images & video: send as inline base64 data
  const buffer = fs.readFileSync(filePath);
  const result = await model.generateContent([
    { text: prompt || "Describe and analyse this file in detail." },
    { inlineData: { data: buffer.toString("base64"), mimeType } },
  ]);
  return result.response.text();
}

export const geminiReady = !!genAI;
