// ==========================================================
//  Settings page logic (settings.html)
// ==========================================================
import { initFirebase, watchAuth, logout, isFirebaseEnabled } from "./firebase.js";
import { api } from "./api.js";
import { toast, initials } from "./utils.js";
import { bindThemeToggles, applyTheme } from "./theme.js";

const $ = (id) => document.getElementById(id);

(async function () {
  bindThemeToggles();
  // Explicit Light/Dark buttons
  document.querySelectorAll("[data-set-theme]").forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.setTheme));
  });

  await initFirebase();

  if (!isFirebaseEnabled()) {
    $("guestNote").classList.remove("hidden");
    $("profileForm").classList.add("hidden");
  }

  watchAuth(async (user) => {
    if (!user) {
      if (isFirebaseEnabled()) { location.href = "/login"; }
      return;
    }
    $("settingsName").textContent = user.displayName || user.email;
    $("settingsAvatar").textContent = initials(user.displayName || user.email);
    $("emailField").value = user.email || "";

    try {
      const { profile } = await api.getProfile();
      if (profile) {
        $("usernameField").value = profile.username || user.displayName || "";
        $("genderField").value = profile.gender || "";
        $("dobField").value = profile.dateOfBirth || "";
      }
    } catch {}
  });

  $("profileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';
    try {
      await api.updateProfile({
        username: $("usernameField").value.trim(),
        gender: $("genderField").value,
        dateOfBirth: $("dobField").value,
      });
      toast("Profile updated!", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Changes";
    }
  });

  $("backBtn")?.addEventListener("click", () => (location.href = "/"));
  $("logoutBtn2")?.addEventListener("click", async () => {
    await logout();
    toast("Logged out", "success");
    setTimeout(() => (location.href = "/"), 500);
  });
})();
