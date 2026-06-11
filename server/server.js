// ==========================================================
//  THE ARK AI - Express server entry point
//  MVC architecture: routes -> controllers -> services
// ==========================================================
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import { env, validateEnv } from "./config/env.js";
import "./config/firebase.js"; // initialise admin
import { logger } from "./utils/logger.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import configRoutes from "./routes/configRoutes.js";
import generateRoutes from "./routes/generateRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

validateEnv();

const app = express();

// ---- Security & parsing ----
app.use(
  helmet({
    contentSecurityPolicy: false, // allow inline scripts/CDN for the demo
    crossOriginEmbedderPolicy: false,
    // IMPORTANT: COOP must allow popups, otherwise Firebase Google
    // sign-in popups cannot post their result back and report
    // "popup-closed-by-user" / "cancelled". This permits the popup
    // to communicate with the opener window.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);
app.use(
  cors({
    origin: env.clientOrigin === "*" ? true : env.clientOrigin.split(","),
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// ---- Static assets (with light caching for performance) ----
app.use("/uploads", express.static(path.join(ROOT, "server", "uploads")));
app.use(
  express.static(path.join(ROOT, "public"), {
    etag: true,
    lastModified: true,
    maxAge: env.nodeEnv === "production" ? "1h" : 0,
    setHeaders: (res, filePath) => {
      // Always revalidate HTML so users get the latest app shell
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

// ---- API routes ----
app.use("/api", apiLimiter);
app.use("/api/config", configRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/user", userRoutes);
app.use("/api/generate", generateRoutes);

app.get("/api/health", (req, res) =>
  res.json({ success: true, message: "The Ark AI is running 🚀", time: new Date().toISOString() })
);

// ---- Live-reload (development only) ----
// Each browser opens an SSE connection to /__livereload. When the server
// restarts (e.g. nodemon after a file change), the connection drops and the
// client reconnects, then reloads the page so you always see the latest code.
if (env.nodeEnv !== "production") {
  const bootId = Date.now().toString();
  app.get("/__livereload", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`data: ${bootId}\n\n`);
    const ping = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => clearInterval(ping));
  });
  logger.info("🔄 Live-reload enabled (dev mode) — browser refreshes on restart.");
}

// ---- HTML page routes (clean URLs) ----
const page = (file) => (req, res) => res.sendFile(path.join(ROOT, "public", file));
app.get("/", page("index.html"));
app.get("/login", page("login.html"));
app.get("/signup", page("signup.html"));
app.get("/settings", page("settings.html"));

// ---- Error handling ----
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  logger.info(`The Ark AI server running at http://localhost:${env.port}`);
  logger.info(`Environment: ${env.nodeEnv}`);
});

export default app;
