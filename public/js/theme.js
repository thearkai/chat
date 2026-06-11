// ==========================================================
//  Theme manager: light / dark with persistence + system pref
//  Apply ASAP (before paint) to avoid a flash of wrong theme.
// ==========================================================
const KEY = "ark-theme";

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "dark";
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(KEY, theme); } catch {}
  // keep the address-bar / UI colour in sync
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#ffffff" : "#0b1220");
}

export function toggleTheme() {
  applyTheme(getTheme() === "dark" ? "light" : "dark");
  return getTheme();
}

// Resolve the initial theme: saved > system preference > dark
export function initTheme() {
  let theme = "dark";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") theme = saved;
    else if (window.matchMedia?.("(prefers-color-scheme: light)").matches) theme = "light";
  } catch {}
  applyTheme(theme);
  return theme;
}

// Update any [data-theme-label] text to reflect what clicking will do
function syncLabels() {
  const isLight = getTheme() === "light";
  document.querySelectorAll("[data-theme-label]").forEach((el) => {
    el.textContent = isLight ? "Light mode" : "Dark mode";
  });
}

// Wire any element with [data-theme-toggle]
export function bindThemeToggles() {
  syncLabels();
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = toggleTheme();
      btn.setAttribute("aria-pressed", String(t === "light"));
      syncLabels();
    });
  });
}

// Apply immediately on import (module runs in <head> as type=module)
initTheme();
