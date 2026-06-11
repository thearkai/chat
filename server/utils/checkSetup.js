// ==========================================================
//  Setup checker - run with: npm run check-setup
//  Validates .env and tells you exactly what is missing
//  or misformatted before you start the server.
// ==========================================================
import { env } from "../config/env.js";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let hardFail = false;

function line(ok, label, hint = "") {
  const icon = ok ? `${GREEN}✔${RESET}` : `${RED}✗${RESET}`;
  const tail = ok ? "" : hint ? `  ${DIM}${hint}${RESET}` : "";
  console.log(`  ${icon} ${label}${tail}`);
}
function warn(label, hint = "") {
  console.log(`  ${YELLOW}!${RESET} ${label}  ${DIM}${hint}${RESET}`);
}

console.log(`\n${"=".repeat(56)}`);
console.log("  THE ARK AI — Setup Checker");
console.log(`${"=".repeat(56)}\n`);

// ---- 1. Gemini (required) ----
console.log(`① AI Provider (active: ${env.aiProvider.toUpperCase()})`);
const geminiOk = !!env.gemini.apiKey && !env.gemini.apiKey.includes("your_");
const deepseekOk = !!env.deepseek.apiKey && !env.deepseek.apiKey.includes("your_");
const openrouterOk = !!env.openaiCompat.apiKey && !env.openaiCompat.apiKey.includes("your_");
const prov = env.aiProvider;

if (prov === "openrouter" || prov === "openai") {
  line(openrouterOk, "OPENROUTER_API_KEY", "Get one at https://openrouter.ai/keys");
  line(!!env.openaiCompat.model, `OPENROUTER_MODEL = ${env.openaiCompat.model}`);
  if (!openrouterOk) hardFail = true;
  if (geminiOk) line(true, "GEMINI_API_KEY present (image/video analysis enabled)");
  else warn("No GEMINI_API_KEY", "image/video analysis disabled (text models can't see images)");
} else if (prov === "deepseek") {
  line(deepseekOk, "DEEPSEEK_API_KEY", "Get one at https://platform.deepseek.com");
  line(!!env.deepseek.model, `DEEPSEEK_MODEL = ${env.deepseek.model}`);
  if (!deepseekOk) hardFail = true;
  if (geminiOk) line(true, "GEMINI_API_KEY present (image/video analysis enabled)");
  else warn("No GEMINI_API_KEY", "image/video analysis disabled (DeepSeek is text-only)");
} else {
  line(geminiOk, "GEMINI_API_KEY", "Get one at https://aistudio.google.com/app/apikey");
  line(!!env.gemini.model, `GEMINI_MODEL = ${env.gemini.model || "(unset)"}`);
  if (!geminiOk) hardFail = true;
}

// ---- 2. Firebase Web (login) ----
console.log("\n② Firebase Web config (login / Google sign-in)");
const fw = env.firebaseWeb;
const webKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
const webOk = webKeys.every((k) => fw[k] && !String(fw[k]).includes("your_"));
webKeys.forEach((k) =>
  line(!!fw[k] && !String(fw[k]).includes("your_"), `FIREBASE_${k.replace(/([A-Z])/g, "_$1").toUpperCase()}`)
);

// ---- 3. Firebase Admin (history) ----
console.log("\n③ Firebase Admin config (saving chat history)");
const fa = env.firebaseAdmin;
line(!!fa.projectId && !fa.projectId.includes("your_"), "FIREBASE_PROJECT_ID");
line(!!fa.clientEmail && !fa.clientEmail.includes("your_"), "FIREBASE_CLIENT_EMAIL");
const keyLooksValid =
  fa.privateKey.includes("BEGIN PRIVATE KEY") &&
  fa.privateKey.includes("END PRIVATE KEY") &&
  fa.privateKey.includes("\n");
line(keyLooksValid, "FIREBASE_PRIVATE_KEY", 'Must be wrapped in quotes and contain \\n line breaks');

const adminOk = fa.projectId && fa.clientEmail && keyLooksValid;
const firebaseOk = webOk && adminOk;

// ---- 4. Cloudinary (optional) ----
console.log("\n④ Cloudinary (optional — persistent media)");
if (env.cloudinary.enabled) {
  const cOk = env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret;
  line(cOk, "Cloudinary credentials", cOk ? "" : "USE_CLOUDINARY=true but credentials incomplete");
} else {
  warn("Disabled (USE_CLOUDINARY=false)", "Files will be stored locally in server/uploads/");
}

// ---- 5. Server ----
console.log("\n⑤ Server");
line(!!env.port, `PORT = ${env.port}`);
line(!!env.clientOrigin, `CLIENT_ORIGIN = ${env.clientOrigin}`);
line(!!env.uploads.maxFileSizeMb, `MAX_FILE_SIZE_MB = ${env.uploads.maxFileSizeMb}`);

// ---- Summary ----
console.log(`\n${"=".repeat(56)}`);
const aiOk = (prov === "openrouter" || prov === "openai") ? openrouterOk
  : prov === "deepseek" ? deepseekOk
  : geminiOk;
const P = env.aiProvider.toUpperCase();
if (hardFail) {
  console.log(`${RED}  ✗ NOT READY${RESET} — ${P} API key missing. AI will not respond.`);
} else if (firebaseOk) {
  console.log(`${GREEN}  ✔ FULLY READY${RESET} — ${P} + Firebase configured. All features on.`);
} else if (aiOk) {
  console.log(`${YELLOW}  ◑ GUEST MODE READY${RESET} — ${P} works; Firebase incomplete (no login/history).`);
}
console.log(`${"=".repeat(56)}\n`);

process.exit(hardFail ? 1 : 0);
