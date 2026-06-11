// ==========================================================
//  Client-side validation helpers
// ==========================================================
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
export const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
export const minLen = (v, n) => (v || "").trim().length >= n;
