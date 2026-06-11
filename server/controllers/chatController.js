// ==========================================================
//  Chat controller – Gemini chat + history persistence
// ==========================================================
import { ok, fail } from "../utils/apiResponse.js";
import { sanitize } from "../utils/validators.js";
import {
  generateReply,
  streamReply,
  aiReady,
} from "../services/aiService.js";
import {
  createChat,
  listChats,
  renameChat,
  deleteChat,
  addMessage,
  listMessages,
} from "../services/firestoreService.js";

// POST /api/chat/message  (optionalAuth) – standard reply
export async function sendMessage(req, res, next) {
  try {
    if (!aiReady) return fail(res, "AI service is not configured. Set the API key for the active provider.", 503);
    const message = sanitize(req.body.message);
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    let chatId = req.body.chatId || null;

    if (!message) return fail(res, "Message cannot be empty.", 422);

    const reply = await generateReply(message, history);

    // Persist for logged-in users only
    if (req.user) {
      if (!chatId) {
        const chat = await createChat(req.user.uid, message.slice(0, 40));
        chatId = chat?.chatId || null;
      }
      if (chatId) {
        await addMessage(chatId, "user", message);
        await addMessage(chatId, "assistant", reply);
      }
    }

    return ok(res, { reply, chatId }, "Reply generated.");
  } catch (e) {
    next(e);
  }
}

// POST /api/chat/stream  (optionalAuth) – Server-Sent-Events streaming
export async function streamMessage(req, res) {
  if (!aiReady) {
    res.writeHead(503, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ success: false, message: "AI not configured." }));
  }

  const message = sanitize(req.body.message);
  const history = Array.isArray(req.body.history) ? req.body.history : [];
  let chatId = req.body.chatId || null;

  if (!message) {
    res.writeHead(422, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ success: false, message: "Message required." }));
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let full = "";
  try {
    for await (const chunk of streamReply(message, history)) {
      full += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    if (req.user) {
      if (!chatId) {
        const chat = await createChat(req.user.uid, message.slice(0, 40));
        chatId = chat?.chatId || null;
      }
      if (chatId) {
        await addMessage(chatId, "user", message);
        await addMessage(chatId, "assistant", full);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, chatId })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
}

// ---- History management (requires auth) ----
export async function getChats(req, res, next) {
  try {
    const chats = await listChats(req.user.uid);
    return ok(res, { chats });
  } catch (e) {
    next(e);
  }
}

export async function getChatMessages(req, res, next) {
  try {
    const messages = await listMessages(req.params.chatId);
    return ok(res, { messages });
  } catch (e) {
    next(e);
  }
}

export async function newChat(req, res, next) {
  try {
    const chat = await createChat(req.user.uid, sanitize(req.body.title) || "New Chat");
    return ok(res, { chat }, "Chat created.");
  } catch (e) {
    next(e);
  }
}

export async function updateChat(req, res, next) {
  try {
    await renameChat(req.user.uid, req.params.chatId, sanitize(req.body.title));
    return ok(res, {}, "Chat renamed.");
  } catch (e) {
    next(e);
  }
}

export async function removeChat(req, res, next) {
  try {
    await deleteChat(req.user.uid, req.params.chatId);
    return ok(res, {}, "Chat deleted.");
  } catch (e) {
    next(e);
  }
}
