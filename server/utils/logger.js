// ==========================================================
//  Tiny timestamped logger utility
// ==========================================================
const ts = () => new Date().toISOString();

export const logger = {
  info: (...a) => console.log(`[INFO  ${ts()}]`, ...a),
  warn: (...a) => console.warn(`[WARN  ${ts()}]`, ...a),
  error: (...a) => console.error(`[ERROR ${ts()}]`, ...a),
  debug: (...a) => {
    if (process.env.NODE_ENV !== "production") console.log(`[DEBUG ${ts()}]`, ...a);
  },
};
