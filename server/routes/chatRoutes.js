import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { aiLimiter } from "../middleware/rateLimiter.js";
import {
  sendMessage,
  streamMessage,
  getChats,
  getChatMessages,
  newChat,
  updateChat,
  removeChat,
} from "../controllers/chatController.js";

const router = Router();

// Chat (works for guests + users)
router.post("/message", aiLimiter, optionalAuth, sendMessage);
router.post("/stream", aiLimiter, optionalAuth, streamMessage);

// History (logged-in only)
router.get("/list", requireAuth, getChats);
router.get("/:chatId/messages", requireAuth, getChatMessages);
router.post("/new", requireAuth, newChat);
router.put("/:chatId", requireAuth, updateChat);
router.delete("/:chatId", requireAuth, removeChat);

export default router;
