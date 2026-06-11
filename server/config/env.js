// ==========================================================
//  Centralised environment configuration loader
// ==========================================================
import dotenv from "dotenv";
dotenv.config();

const toBool = (v) => String(v).toLowerCase() === "true";

// Make the Firebase private key resilient to common .env mistakes.
function normalizePrivateKey(raw) {
  let k = raw || "";
  k = k.trim();
  // strip a single pair of surrounding quotes if present
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  // convert literal \n (and \r\n) escapes into real newlines, strip CR
  k = k.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r/g, "");
  return k;
}

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigin: process.env.CLIENT_ORIGIN || "*",

  // Which provider handles chat: "openrouter", "deepseek" or "gemini"
  aiProvider: (process.env.AI_PROVIDER || "gemini").toLowerCase(),

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  },

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  },

  // Generic OpenAI-compatible provider (OpenRouter by default)
  openaiCompat: {
    apiKey: process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY || "",
    model: process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free",
    baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    referer: process.env.OPENROUTER_REFERER || process.env.CLIENT_ORIGIN || "http://localhost:5000",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 60000),
  },

  firebaseAdmin: {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    // Normalise the private key so common copy/paste mistakes still work:
    //  - strip surrounding single/double quotes
    //  - convert literal \n escapes into real newlines
    //  - strip Windows CR characters that corrupt the PEM
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  },

  // Web config sent to the browser (safe – these are public client keys)
  firebaseWeb: {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
  },

  uploads: {
    maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 25),
    dir: process.env.UPLOAD_DIR || "server/uploads",
  },

  cloudinary: {
    enabled: toBool(process.env.USE_CLOUDINARY),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },

  rateLimit: {
    windowMin: Number(process.env.RATE_LIMIT_WINDOW_MIN || 15),
    max: Number(process.env.RATE_LIMIT_MAX || 100),
  },
};

// Helpful warning when keys are missing (does not crash – guest mode still works)
export function validateEnv() {
  const warnings = [];
  if (env.aiProvider === "deepseek" && !env.deepseek.apiKey)
    warnings.push("AI_PROVIDER=deepseek but DEEPSEEK_API_KEY is missing – AI responses will fail.");
  if (env.aiProvider === "gemini" && !env.gemini.apiKey)
    warnings.push("GEMINI_API_KEY is missing – AI responses will fail.");
  if (env.aiProvider === "deepseek" && !env.gemini.apiKey)
    warnings.push("No GEMINI_API_KEY – image/video file analysis will be unavailable (DeepSeek is text-only).");
  if (!env.firebaseAdmin.projectId)
    warnings.push("FIREBASE_PROJECT_ID is missing – history saving disabled (guest mode only).");
  if (warnings.length) {
    console.warn("\n⚠️  Configuration warnings:");
    warnings.forEach((w) => console.warn("   - " + w));
    console.warn("");
  }
}
