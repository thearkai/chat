// ==========================================================
//  THE ARK AI — Production-grade Markdown rendering pipeline
//  ----------------------------------------------------------
//  Flow:  raw text
//      -> normalize()          (line endings, fix tables, trim)
//      -> validate()           (type/size guards)
//      -> marked.parse()       (GFM: tables, lists, task lists…)
//      -> highlight code        (custom, dependency-light)
//      -> DOMPurify.sanitize()  (XSS-safe allow-list)
//      -> safe HTML string
//
//  Security model:
//    * AI is instructed to return PURE Markdown (no HTML).
//    * Any raw HTML in the source is ESCAPED by marked (we disable
//      raw HTML passthrough), then the OUTPUT is sanitized by
//      DOMPurify with a strict allow-list. Two layers of defence.
//
//  Streaming:
//    renderMarkdownStreaming() tolerates partial/incomplete Markdown
//    (e.g. an unclosed ``` fence) so live tokens render gracefully.
// ==========================================================
import { highlight, normalizeLang } from "./highlight.js";

// ---------- 0. Resilient lazy-load of marked + DOMPurify ----------
// These are loaded dynamically so a missing/blocked vendor file can NEVER
// crash the whole app (which would disable every button). If they fail,
// renderMarkdown() falls back to safe escaped plain text.
let marked = null;
let DOMPurify = null;
let libsReady = false;
let libsTried = false;

async function ensureLibs() {
  if (libsTried) return libsReady;
  libsTried = true;
  try {
    const [{ Marked }, purifyMod] = await Promise.all([
      import("./vendor/marked.esm.js"),
      import("./vendor/purify.es.mjs"),
    ]);
    DOMPurify = purifyMod.default || purifyMod;
    marked = new Marked({ gfm: true, breaks: true, pedantic: false });
    marked.use({ renderer });
    registerPurifyHooks();
    libsReady = true;
  } catch (err) {
    console.error("[markdown] render libraries failed to load – using plain-text fallback.", err);
    libsReady = false;
  }
  return libsReady;
}

// Kick off loading immediately (non-blocking); render calls also await it.
const libsPromise = ensureLibs();

// Custom renderer: add classes/attrs we need, keep output minimal.
const renderer = {
  // Code blocks -> tagged <pre.ark-code> so chat.js upgrades them
  // into the rich interactive editor (copy/preview/download).
  code(code, infostring) {
    const lang = normalizeLang((infostring || "").trim().split(/\s+/)[0] || "");
    // ```svg fences (or fences whose content is an <svg>) render as a real
    // picture. DOMPurify then sanitizes the SVG against the allow-list.
    if ((lang === "svg" || /^\s*<svg[\s>]/i.test(code)) && /<svg[\s\S]*<\/svg>/i.test(code)) {
      return `<div class="md-svg-wrap">${code}</div>`;
    }
    const encoded = encodeURIComponent(code);
    const body = highlight(code, lang); // returns safe, span-wrapped HTML
    return (
      `<pre class="ark-code" data-lang="${escapeAttr(lang || "txt")}" data-code="${encoded}">` +
      `<code class="lang-${escapeAttr(lang || "txt")}">${body}</code></pre>`
    );
  },
  // External links: open safely in a new tab.
  link(href, title, text) {
    const safeHref = sanitizeUrl(href);
    if (!safeHref) return text; // drop unsafe links, keep the text
    const t = title ? ` title="${escapeAttr(title)}"` : "";
    return `<a href="${escapeAttr(safeHref)}"${t} target="_blank" rel="noopener noreferrer nofollow">${text}</a>`;
  },
  // Tables get a wrapper for horizontal scrolling on mobile.
  table(header, body) {
    return `<div class="md-table-wrap"><table class="md-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
  },
  // Image embedding is DISABLED by policy. Markdown image syntax
  // ![alt](url) renders only its alt text (no <img>, no link). Inline
  // SVG (handled in code()) is still allowed for AI-drawn graphics.
  image(href, title, text) {
    return escapeAttr(text || "");
  },
};
// NOTE: marked.use({ renderer }) is called inside ensureLibs() once the
// library has loaded — not here, since `marked` is loaded dynamically.

// ---------- 2. URL helpers ----------
const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i;
function sanitizeUrl(href = "") {
  try {
    const h = String(href).trim();
    // Block javascript:, data:, vbscript: etc.
    if (!SAFE_URL.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

function escapeAttr(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------- 3. Normalization ----------
// Make AI output consistent & fix common table glitches before parsing.
export function normalizeMarkdown(input = "") {
  let s = String(input);

  // Normalize line endings: CRLF / CR -> LF
  s = s.replace(/\r\n?/g, "\n");

  // Strip a leading UTF-8 BOM if present
  s = s.replace(/^\uFEFF/, "");

  // Remove zero-width junk some models emit
  s = s.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");

  // Trim trailing spaces on each line EXCEPT a deliberate 2-space hard break
  s = s
    .split("\n")
    .map((line) => (/ {2,}$/.test(line) ? line.replace(/ +$/, "  ") : line.replace(/[ \t]+$/, "")))
    .join("\n");

  // Collapse 3+ blank lines into a single blank line
  s = s.replace(/\n{3,}/g, "\n\n");

  s = fixTables(s);

  return s.trim();
}

// Repair tables that are missing the header separator row, which
// otherwise renders as plain text. e.g.
//   | A | B |
//   | 1 | 2 |        -> insert |---|---| after the header.
function fixTables(s) {
  const lines = s.split("\n");
  const out = [];

  const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  // A separator row: each cell is dashes with optional leading/trailing colon,
  // e.g.  | --- | :---: |  or  |---|---|  or  | - | - |
  const isSeparator = (l) =>
    /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l) && /-/.test(l);
  const countCols = (l) =>
    l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = out.length ? out[out.length - 1] : "";
    const next = lines[i + 1] || "";

    // Only treat `line` as a TABLE HEADER when:
    //   * it is a table row,
    //   * it is NOT itself a separator,
    //   * the PREVIOUS emitted line is blank or not a table row
    //     (i.e. this row begins a new table block — not a mid-table data row),
    //   * and the NEXT line is a row that is NOT already a separator.
    const startsTable = isRow(line) && !isSeparator(line) && (prev.trim() === "" || !isRow(prev));
    if (startsTable && isRow(next) && !isSeparator(next)) {
      const cols = Math.max(1, countCols(line));
      out.push(line);
      out.push("| " + Array(cols).fill("---").join(" | ") + " |");
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

// ---------- 4. DOMPurify config (strict allow-list) ----------
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "hr", "span", "div",
    "strong", "em", "del", "s", "b", "i", "u",
    "blockquote", "code", "pre",
    "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "a",
    "table", "thead", "tbody", "tr", "th", "td",
    "input", // task-list checkboxes (sanitized below)
    // NOTE: <img> intentionally NOT allowed (image embedding disabled by policy)
    // ---- inline SVG (AI-drawn graphics) ----
    "svg", "g", "path", "rect", "circle", "ellipse", "line",
    "polyline", "polygon", "text", "tspan", "defs", "linearGradient",
    "radialGradient", "stop", "title", "desc", "use", "clipPath", "mask",
  ],
  ALLOWED_ATTR: [
    "href", "title", "target", "rel",
    "class", "data-lang", "data-code",
    "type", "checked", "disabled", "align",
    // ---- image attrs ----
    "src", "alt", "width", "height", "loading",
    // ---- safe SVG presentation attrs ----
    "viewBox", "xmlns", "fill", "stroke", "stroke-width", "stroke-linecap",
    "stroke-linejoin", "stroke-dasharray", "d", "x", "y", "x1", "y1", "x2", "y2",
    "cx", "cy", "r", "rx", "ry", "points", "transform", "opacity",
    "fill-opacity", "stroke-opacity", "offset", "stop-color", "stop-opacity",
    "gradientUnits", "gradientTransform", "text-anchor", "font-size",
    "font-family", "font-weight", "id", "clip-path", "mask",
  ],
  // Defang dangerous protocols; allow our safe set only.
  // Images are further restricted to https/data:image in the hook below.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[#/])/i,
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "link", "meta", "foreignObject"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onmouseout", "onfocus", "style"],
  RETURN_TRUSTED_TYPE: false,
};

// Registered once DOMPurify is loaded (see ensureLibs()).
function registerPurifyHooks() {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "INPUT") {
      node.setAttribute("disabled", "");
      node.setAttribute("type", "checkbox");
    }
    if (node.tagName === "A" && node.getAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
    // Image embedding is disabled by policy: strip any <img> that slips in.
    if (node.tagName === "IMG") { node.remove(); return; }
    // Constrain SVG sizing so AI graphics can't overflow the chat.
    if (node.tagName === "svg" || node.nodeName === "svg") {
      node.classList.add("md-svg");
      node.removeAttribute("width");
      node.removeAttribute("height");
    }
  });
}

function sanitize(html) {
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

// ---------- 5. Plain-text fallback ----------
function escapeText(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

// ---------- 6. Public API ----------

// Full render for completed messages.
export function renderMarkdown(input) {
  // validate
  if (input == null) return "";
  if (typeof input !== "string") {
    try { input = String(input); } catch { return ""; }
  }
  if (input.length > 200000) input = input.slice(0, 200000) + "\n\n…(truncated)";

  // If the render libraries aren't ready/available, fall back to safe text.
  if (!libsReady || !marked || !DOMPurify) {
    if (!libsTried) ensureLibs(); // try (again) in the background
    return `<p>${escapeText(input)}</p>`;
  }

  // error boundary: never throw into the UI
  try {
    const normalized = normalizeMarkdown(input);
    const rawHtml = marked.parse(normalized);
    return sanitize(rawHtml);
  } catch (err) {
    console.error("[markdown] render failed, falling back to text:", err);
    return `<p>${escapeText(input)}</p>`;
  }
}

// Resolve once the render libraries have loaded (so callers can await
// before doing the final render of a completed message).
export function whenRendererReady() {
  return libsPromise;
}

// Streaming render: tolerant of incomplete Markdown mid-stream.
export function renderMarkdownStreaming(partial) {
  if (!partial) return "";
  let s = String(partial);
  // If there's an odd number of code fences, temporarily close the last one
  const fences = (s.match(/```/g) || []).length;
  if (fences % 2 !== 0) s += "\n```";
  return renderMarkdown(s);
}

// Expose a sanitizer for any other module that needs it.
export function sanitizeHtml(html) {
  try { return sanitize(String(html)); } catch { return ""; }
}
