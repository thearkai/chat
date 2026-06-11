// ==========================================================
//  Lightweight input validation helpers
// ==========================================================
export const isEmail = (v) =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

export const minLen = (v, n) => typeof v === "string" && v.trim().length >= n;

export const sanitize = (v) =>
  typeof v === "string" ? v.replace(/[<>]/g, "").trim() : v;

// Validate a registration payload, returns { valid, errors }
export function validateRegistration(body) {
  const errors = [];
  if (!isNonEmpty(body.username)) errors.push("Username is required.");
  if (!isEmail(body.email)) errors.push("A valid email is required.");
  if (!minLen(body.password, 6)) errors.push("Password must be at least 6 characters.");
  if (body.gender && !["male", "female", "other", "prefer-not"].includes(body.gender))
    errors.push("Invalid gender value.");
  return { valid: errors.length === 0, errors };
}
