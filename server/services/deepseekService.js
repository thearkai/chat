// ==========================================================
//  DeepSeek AI service (OpenAI-compatible REST API)
//  Handles chat + streaming. Text-only (no vision).
//  Docs: https://api-docs.deepseek.com
// ==========================================================
import { env } from "../config/env.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";


export const deepseekReady = !!env.deepseek.apiKey;

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

async function callApi(body, signal) {
  const res = await fetch(`${env.deepseek.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.deepseek.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch { detail = await res.text().catch(() => ""); }
    const err = new Error(`DeepSeek API error [${res.status}]: ${detail || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

// ---- Standard (non-streamed) chat ----
export async function generateReply(message, history = []) {
  const res = await callApi({
    model: env.deepseek.model,
    messages: toMessages(message, history),
    stream: false,
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ---- Streaming chat (yields text chunks) ----
export async function* streamReply(message, history = []) {
  const res = await callApi({
    model: env.deepseek.model,
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

// ---- Text-based document analysis (PDF/TXT/HTML already extracted to text) ----
export async function analyzeText(text, prompt) {
  return generateReply(
    `${prompt || "Analyse and summarise this document."}\n\n--- CONTENT ---\n${text}`,
    []
  );
}
