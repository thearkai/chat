// ==========================================================
//  Firebase Web SDK initialisation (client-side auth)
//  Loaded from the official CDN as ES modules.
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let app = null;
let auth = null;
let firebaseEnabled = false;
let _readyResolve;
export const firebaseReady = new Promise((r) => (_readyResolve = r));

// Fetch public config from backend, then init
export async function initFirebase() {
  try {
    const res = await fetch("/api/config");
    const { data } = await res.json();
    const cfg = data.firebase;
    if (cfg && cfg.apiKey && cfg.projectId) {
      app = initializeApp(cfg);
      auth = getAuth(app);
      firebaseEnabled = true;
    }
  } catch (e) {
    console.warn("Firebase config not available – guest mode only.", e.message);
  }
  _readyResolve(firebaseEnabled);
  return firebaseEnabled;
}

export function isFirebaseEnabled() { return firebaseEnabled; }
export function getAuthInstance() { return auth; }

export async function getIdToken() {
  if (!auth || !auth.currentUser) return null;
  try { return await auth.currentUser.getIdToken(); } catch { return null; }
}

export function watchAuth(cb) {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}

// ---- Auth actions ----
export async function registerEmail({ email, password, username }) {
  if (!auth) throw new Error("Authentication is not configured on this server.");
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (username) await updateProfile(cred.user, { displayName: username });
  return cred.user;
}

export async function loginEmail({ email, password }) {
  if (!auth) throw new Error("Authentication is not configured on this server.");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginGoogle() {
  if (!auth) throw new Error("Authentication is not configured on this server.");
  const provider = new GoogleAuthProvider();
  // Always let the user choose which Google account to use
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    // If the popup is blocked/closed by the browser environment,
    // fall back to a full-page redirect (more reliable).
    const fallbackCodes = [
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/cancelled-popup-request",
      "auth/operation-not-supported-in-this-environment",
    ];
    if (fallbackCodes.includes(err.code)) {
      await signInWithRedirect(auth, provider);
      return null; // result handled after redirect by checkRedirectResult()
    }
    throw err;
  }
}

// Call once on page load to capture the result of a redirect sign-in
export async function checkRedirectResult() {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (e) {
    console.warn("Redirect sign-in result error:", e.message);
    return null;
  }
}

export async function logout() {
  if (auth) await signOut(auth);
}
