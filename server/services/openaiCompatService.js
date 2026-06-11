// ==========================================================
//  OpenAI-compatible chat service
//  Works with OpenRouter, DeepSeek, Groq, etc. (any provider
//  exposing the /chat/completions endpoint). Text-only.
// ==========================================================
import { env } from "../config/env.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";


const cfg = env.openaiCompat;
export const openaiCompatReady = !!cfg.apiKey;

function headers() {
  const h = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  // OpenRouter likes (optional) attribution headers
  if (cfg.baseUrl.includes("openrouter")) {
    h["HTTP-Referer"] = cfg.referer || "http://localhost:5000";
    h["X-Title"] = "The Ark AI";
  }
  return h;
}

function toMessages(message, history = []) {
  const msgs = [{ role: "system", content: SYSTEM_PROMPT }];
  history
    .filter((m) => m && m.content)
    .forEach((m) =>
      msgs.push({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) })
    );
  msgs.push({ role: "user", content: message });
  return msgs;
}

async function callApi(body) {
  // Abort the request if the provider stalls (free models can hang),
  // so the user gets a clear error instead of an endless "no response".
  const controller = new AbortController();
  const timeoutMs = Number(cfg.timeoutMs || 60000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      const err = new Error(
        `The AI took too long to respond (over ${Math.round(timeoutMs / 1000)}s) and timed out. ` +
        `Try again, shorten the conversation, or switch to a faster model.`
      );
      err.status = 504;
      throw err;
    }
    throw e;
  }
  clearTimeout(timer);

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; }
    catch { detail = await res.text().catch(() => ""); }
    const err = new Error(`AI provider error [${res.status}]: ${detail || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

// ---- Standard chat ----
export async function generateReply(message, history = []) {
  const res = await callApi({
    model: cfg.model,
    messages: toMessages(message, history),
    stream: false,
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ---- Streaming chat ----
export async function* streamReply(message, history = []) {
  const res = await callApi({
    model: cfg.model,
    messages: toMessages(message, history),
    stream: true,
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const chunk = json.choices?.[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch { /* ignore keep-alive / partial lines */ }
    }
  }
}

// ---- Text document analysis ----
export async function analyzeText(text, prompt) {
  return generateReply(
    `${prompt || "Analyse and summarise this document."}\n\n--- CONTENT ---\n${text}`,
    []
  );
}
