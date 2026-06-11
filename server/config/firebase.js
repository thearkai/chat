// ==========================================================
//  Firebase Admin SDK initialisation
//  Credential sources (in priority order):
//    1. serviceAccountKey.json file (set FIREBASE_SERVICE_ACCOUNT
//       or drop the file in the project root / server/config)
//    2. .env variables (FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY)
//  Gracefully degrades to "guest only" mode if neither is available.
// ==========================================================
import admin from "firebase-admin";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");

let firebaseEnabled = false;
let db = null;
let authAdmin = null;

// Validate the PEM up-front so we can show a clear message instead of
// the cryptic "DECODER routines::unsupported" error later on.
function privateKeyIsValid(pem) {
  if (!pem || !pem.includes("BEGIN PRIVATE KEY") || !pem.includes("END PRIVATE KEY")) return false;
  try { crypto.createPrivateKey(pem); return true; } catch { return false; }
}

// Look for a service-account JSON file in common locations.
function findServiceAccountFile() {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT,            // explicit path (optional)
    process.env.GOOGLE_APPLICATION_CREDENTIALS,       // Google standard var
    path.join(ROOT, "serviceAccountKey.json"),        // project root
    path.join(ROOT, "server", "config", "serviceAccountKey.json"),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
      if (fs.existsSync(abs)) return abs;
    } catch { /* ignore */ }
  }
  return null;
}

// Build a credential object from a JSON file, or from .env vars.
function loadCredentials() {
  // ---- 1. JSON file ----
  const file = findServiceAccountFile();
  if (file) {
    try {
      const json = JSON.parse(fs.readFileSync(file, "utf-8"));
      const privateKey = (json.private_key || "").replace(/\r/g, "");
      if (!json.project_id || !json.client_email || !privateKeyIsValid(privateKey)) {
        throw new Error("service account JSON is missing fields or has an invalid private_key");
      }
      console.log(`🔑 Using Firebase credentials from file: ${path.basename(file)}`);
      return { source: "file", projectId: json.project_id, clientEmail: json.client_email, privateKey };
    } catch (e) {
      throw new Error(`Could not read service account file (${file}): ${e.message}`);
    }
  }

  // ---- 2. .env variables ----
  const { projectId, clientEmail, privateKey } = env.firebaseAdmin;
  if (projectId && clientEmail && privateKey) {
    if (!privateKeyIsValid(privateKey)) {
      throw new Error(
        "FIREBASE_PRIVATE_KEY is malformed (cannot be decoded). " +
        "Either fix it (wrap in double quotes, keep literal \\n), or simply drop your " +
        "downloaded serviceAccountKey.json into the project root instead."
      );
    }
    console.log("🔑 Using Firebase credentials from .env variables.");
    return { source: "env", projectId, clientEmail, privateKey };
  }

  return null; // nothing configured
}

try {
  const creds = loadCredentials();
  if (creds) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: creds.projectId,
          clientEmail: creds.clientEmail,
          privateKey: creds.privateKey,
        }),
      });
    }
    db = admin.firestore();
    authAdmin = admin.auth();
    firebaseEnabled = true;
    console.log("✅ Firebase Admin initialised.");
  } else {
    console.warn("⚠️  Firebase Admin not configured – running in GUEST-ONLY mode.");
    console.warn("    Tip: drop a serviceAccountKey.json in the project root, or set FIREBASE_* in .env.");
  }
} catch (err) {
  console.error("❌ Firebase Admin init failed:", err.message);
}

export { admin, db, authAdmin, firebaseEnabled };
