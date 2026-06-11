// ==========================================================
//  Code block renderer (syntax highlight + controls) and the
//  live preview side panel + file-download cards.
// ==========================================================
import { highlight, isPreviewable } from "./highlight.js";
import { copyText, toast, escapeHtml } from "./utils.js";

let panel, backdrop, frame, codePane, titleEl;

function ensurePanel() {
  if (panel) return;
  backdrop = document.createElement("div");
  backdrop.className = "preview-backdrop";
  panel = document.createElement("div");
  panel.className = "preview-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Code preview");
  panel.innerHTML = `
    <div class="preview-head">
      <span class="title">Preview</span>
      <span class="spacer"></span>
      <div class="preview-tabs">
        <button class="preview-tab active" data-tab="preview">Preview</button>
        <button class="preview-tab" data-tab="code">Code</button>
      </div>
      <button class="icon-btn" data-close aria-label="Close preview">✕</button>
    </div>
    <div class="preview-body">
      <iframe sandbox="allow-scripts" title="Live code preview"></iframe>
      <pre class="preview-code"><code></code></pre>
    </div>`;
  document.body.append(backdrop, panel);

  frame = panel.querySelector("iframe");
  codePane = panel.querySelector(".preview-code code");
  titleEl = panel.querySelector(".title");

  backdrop.addEventListener("click", closePreview);
  panel.querySelector("[data-close]").addEventListener("click", closePreview);
  panel.querySelectorAll(".preview-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      panel.querySelectorAll(".preview-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      panel.classList.toggle("show-code", tab.dataset.tab === "code");
    });
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePreview(); });
}

export function openPreview(code, lang = "html", label = "Preview") {
  ensurePanel();
  titleEl.textContent = label;
  codePane.textContent = code;
  // build a full document for the iframe
  const doc = /<html[\s>]/i.test(code)
    ? code
    : `<!DOCTYPE html><html><head><meta charset="utf-8">
       <style>body{font-family:system-ui,sans-serif;margin:16px;color:#0f172a;}</style></head>
       <body>${code}</body></html>`;
  frame.srcdoc = doc;
  panel.classList.remove("show-code");
  panel.querySelectorAll(".preview-tab").forEach((t, i) => t.classList.toggle("active", i === 0));
  panel.classList.add("open");
  backdrop.classList.add("show");
}

function closePreview() {
  if (!panel) return;
  panel.classList.remove("open");
  backdrop.classList.remove("show");
  frame.srcdoc = "";
}

// ---------- Render a single code block element ----------
export function createCodeBlock(code, lang = "txt") {
  const wrap = document.createElement("div");
  wrap.className = "code-block";
  const language = (lang || "txt").toLowerCase();

  wrap.innerHTML = `
    <div class="code-head">
      <span class="code-dots"><i></i><i></i><i></i></span>
      <span class="code-lang">${escapeHtml(language)}</span>
      <span class="spacer"></span>
      <button class="code-btn" data-act="copy" title="Copy code">📋 Copy</button>
      <button class="code-btn" data-act="share" title="Share code">🔗 Share</button>
      ${isPreviewable(language) ? '<button class="code-btn" data-act="preview" title="Open live preview">▶ Preview</button>' : ""}
      <button class="code-btn" data-act="download" title="Download as file">⬇ Download</button>
    </div>
    <pre class="code-body"><code>${highlight(code, language)}</code></pre>`;

  const btn = (act) => wrap.querySelector(`[data-act="${act}"]`);

  btn("copy").addEventListener("click", async (e) => {
    await copyText(code);
    flash(e.target, "✓ Copied");
  });
  btn("share").addEventListener("click", async (e) => {
    if (navigator.share) { try { await navigator.share({ title: "Code from The Ark AI", text: code }); } catch {} }
    else { await copyText(code); flash(e.target, "✓ Copied to share"); }
  });
  btn("preview")?.addEventListener("click", () => openPreview(code, language, `Preview (${language})`));
  btn("download").addEventListener("click", () => downloadCode(code, language));

  return wrap;
}

function flash(el, text) {
  const old = el.textContent;
  el.textContent = text; el.classList.add("done");
  setTimeout(() => { el.textContent = old; el.classList.remove("done"); }, 1400);
}

// ---------- Download helpers ----------
import { api } from "./api.js";

async function downloadCode(code, language) {
  try {
    const { file } = await api.generateFile({ content: code, format: "code", language, baseName: "snippet" });
    triggerDownload(file.url, file.filename);
    toast("Code file ready", "success");
  } catch (e) {
    toast(e.message || "Could not generate file", "error");
  }
}

export function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url; a.download = filename || ""; a.target = "_blank";
  document.body.appendChild(a); a.click(); a.remove();
}

// ---------- Download card (offered under document-like replies) ----------
export function createDownloadCard({ label, format, content, language, baseName, title }) {
  const card = document.createElement("div");
  card.className = "download-card";
  const ext = format === "code" ? (language || "txt") : format;
  card.innerHTML = `
    <div class="dl-icon">${(ext || "file").slice(0, 3).toUpperCase()}</div>
    <div class="dl-meta">
      <div class="dl-name">${escapeHtml(label || "Download file")}</div>
      <div class="dl-sub">Generated by The Ark AI · .${escapeHtml(ext)}</div>
    </div>
    <button class="dl-btn">⬇ Download</button>`;
  const btn = card.querySelector(".dl-btn");
  btn.addEventListener("click", async () => {
    btn.classList.add("loading"); btn.textContent = "Generating…";
    try {
      const { file } = await api.generateFile({ content, format, language, baseName, title });
      triggerDownload(file.url, file.filename);
      btn.textContent = "⬇ Download again"; btn.classList.remove("loading");
      toast(`${(format || "file").toUpperCase()} ready`, "success");
    } catch (e) {
      btn.textContent = "⬇ Download"; btn.classList.remove("loading");
      toast(e.message || "Generation failed", "error");
    }
  });
  return card;
}
