// ==========================================================
//  Auth page logic (login.html & signup.html)
// ==========================================================
import {
  initFirebase,
  registerEmail,
  loginEmail,
  loginGoogle,
  checkRedirectResult,
  isFirebaseEnabled,
} from "./firebase.js";
import { api } from "./api.js";
import { toast } from "./utils.js";
import { isEmail } from "./validate.js";

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || "";
}
function clearErrors() {
  document.querySelectorAll(".input-error").forEach((e) => (e.textContent = ""));
}

function togglePasswordButtons() {
  document.querySelectorAll(".toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      input.type = input.type === "password" ? "text" : "password";
      btn.textContent = input.type === "password" ? "👁" : "🙈";
    });
  });
}

async function afterAuth(user, extra = {}) {
  try {
    await api.syncProfile({
      username: user.displayName || extra.username || "",
      gender: extra.gender || "",
      dateOfBirth: extra.dateOfBirth || "",
    });
  } catch (e) {
    console.warn("Profile sync skipped:", e.message);
  }
  toast("Welcome to The Ark AI!", "success");
  setTimeout(() => (window.location.href = "/"), 600);
}

// ---------------- LOGIN ----------------
function initLogin() {
  const form = document.getElementById("loginForm");
  const googleBtn = document.getElementById("googleBtn");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!isEmail(email)) return setError("emailError", "Enter a valid email.");
    if (!password) return setError("passwordError", "Password is required.");

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in...';
    try {
      const user = await loginEmail({ email, password });
      await afterAuth(user);
    } catch (err) {
      toast(friendly(err), "error");
      btn.disabled = false;
      btn.textContent = "Login";
    }
  });

  googleBtn?.addEventListener("click", async () => {
    googleBtn.disabled = true;
    try {
      const user = await loginGoogle();
      if (user) await afterAuth(user);
      // if null -> a redirect is in progress; page will reload
    } catch (err) {
      toast(friendly(err), "error");
      googleBtn.disabled = false;
    }
  });
}

// ---------------- SIGNUP ----------------
function initSignup() {
  const form = document.getElementById("signupForm");
  const googleBtn = document.getElementById("googleBtn");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();
    const username = form.username.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirm = form.confirmPassword.value;
    const gender = form.gender.value;
    const dateOfBirth = form.dateOfBirth.value;

    let bad = false;
    if (username.length < 2) { setError("usernameError", "Username too short."); bad = true; }
    if (!isEmail(email)) { setError("emailError", "Enter a valid email."); bad = true; }
    if (password.length < 6) { setError("passwordError", "Min 6 characters."); bad = true; }
    if (password !== confirm) { setError("confirmError", "Passwords do not match."); bad = true; }
    if (!gender) { setError("genderError", "Select a gender."); bad = true; }
    if (!dateOfBirth) { setError("dobError", "Enter your date of birth."); bad = true; }
    if (bad) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account...';
    try {
      const user = await registerEmail({ email, password, username });
      await afterAuth(user, { username, gender, dateOfBirth });
    } catch (err) {
      toast(friendly(err), "error");
      btn.disabled = false;
      btn.textContent = "Create Account";
    }
  });

  googleBtn?.addEventListener("click", async () => {
    googleBtn.disabled = true;
    try {
      const user = await loginGoogle();
      if (user) await afterAuth(user);
    } catch (err) {
      toast(friendly(err), "error");
      googleBtn.disabled = false;
    }
  });
}

function friendly(err) {
  const m = err.message || "";
  if (m.includes("email-already-in-use")) return "That email is already registered.";
  if (m.includes("invalid-credential") || m.includes("wrong-password")) return "Incorrect email or password.";
  if (m.includes("user-not-found")) return "No account found with that email.";
  if (m.includes("weak-password")) return "Password is too weak.";
  if (m.includes("popup-closed")) return "Sign-in popup closed before completing. Please try again.";
  if (m.includes("popup-blocked")) return "Your browser blocked the popup. Allow popups, or we'll redirect you.";
  if (m.includes("unauthorized-domain")) return "This domain isn't authorised in Firebase. Add it under Authentication → Settings → Authorized domains.";
  if (m.includes("not configured")) return "Authentication isn't configured on this server yet.";
  return m || "Something went wrong.";
}

// Dismiss the auth "modal" when clicking the backdrop (outside the card)
function setupDismiss() {
  const wrap = document.getElementById("authWrap");
  const card = document.getElementById("authCard");
  if (!wrap || !card) return;
  const dest = wrap.dataset.dismissTo || "/";

  wrap.addEventListener("mousedown", (e) => {
    // only when the press starts on the backdrop itself, not the card
    if (e.target === wrap) window.location.href = dest;
  });
  // Escape key closes too
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") window.location.href = dest;
  });
}

(async function () {
  setupDismiss();
  await initFirebase();
  if (!isFirebaseEnabled()) {
    const note = document.getElementById("authNote");
    if (note) {
      note.classList.remove("hidden");
      note.textContent = "Note: Firebase is not configured on this server. You can still use The Ark AI as a guest.";
    }
  }
  togglePasswordButtons();
  if (document.getElementById("loginForm")) initLogin();
  if (document.getElementById("signupForm")) initSignup();

  // If we returned from a redirect-based Google sign-in, complete it.
  if (isFirebaseEnabled()) {
    const user = await checkRedirectResult();
    if (user) await afterAuth(user);
  }
})();
