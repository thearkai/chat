// ==========================================================
//  API client – wraps fetch with auth token + JSON handling
// ==========================================================
import { getIdToken } from "./firebase.js";

const BASE = "/api";

async function request(path, { method = "GET", body, headers = {}, auth = false } = {}) {
  const opts = { method, headers: { ...headers } };

  if (auth) {
    const token = await getIdToken();
    if (token) opts.headers.Authorization = `Bearer ${token}`;
  }

  if (body instanceof FormData) {
    opts.body = body; // browser sets multipart boundary
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, opts);
  let data = {};
  try { data = await res.json(); } catch { /* non-json */ }

  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data.data ?? data;
}

export const api = {
  getConfig: () => request("/config"),

  // chat
  sendMessage: (payload) => request("/chat/message", { method: "POST", body: payload, auth: true }),
  listChats: () => request("/chat/list", { auth: true }),
  getMessages: (chatId) => request(`/chat/${chatId}/messages`, { auth: true }),
  deleteChat: (chatId) => request(`/chat/${chatId}`, { method: "DELETE", auth: true }),
  renameChat: (chatId, title) => request(`/chat/${chatId}`, { method: "PUT", body: { title }, auth: true }),

  // upload
  upload: (formData) => request("/upload", { method: "POST", body: formData, auth: true }),

  // generated downloadable files
  generateFile: (payload) => request("/generate/file", { method: "POST", body: payload, auth: true }),
  capabilities: () => request("/generate/capabilities"),

  // auth / user
  syncProfile: (profile) => request("/auth/sync", { method: "POST", body: profile, auth: true }),
  me: () => request("/auth/me", { auth: true }),
  getProfile: () => request("/user/profile", { auth: true }),
  updateProfile: (profile) => request("/user/profile", { method: "PUT", body: profile, auth: true }),
};

// ---- Streaming via fetch + SSE-style parsing ----
export async function streamMessage(payload, { onChunk, onDone, onError }) {
  try {
    const token = await getIdToken();
    const res = await fetch(`${BASE}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      throw new Error(t || "Streaming failed");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop();
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const json = JSON.parse(line.slice(5).trim());
        if (json.chunk) onChunk?.(json.chunk);
        if (json.error) onError?.(new Error(json.error));
        if (json.done) onDone?.(json.chatId);
      }
    }
  } catch (e) {
    onError?.(e);
  }
}
