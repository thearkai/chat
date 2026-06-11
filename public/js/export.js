// ==========================================================
//  Conversation export: TXT, HTML, PDF (print-to-pdf)
// ==========================================================

function buildPlainText(messages) {
  const header = `THE ARK AI - Conversation Export\nGenerated: ${new Date().toLocaleString()}\n${"=".repeat(50)}\n\n`;
  const body = messages
    .map((m) => `${m.role === "user" ? "You" : "The Ark AI"}:\n${m.content}\n`)
    .join("\n");
  return header + body;
}

function buildHtml(messages) {
  const rows = messages
    .map(
      (m) => `
      <div class="msg ${m.role}">
        <div class="who">${m.role === "user" ? "You" : "The Ark AI"}</div>
        <div class="content">${escapeHtml(m.content).replace(/\n/g, "<br>")}</div>
      </div>`
    )
    .join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
  <title>The Ark AI - Conversation</title>
  <style>
    body{font-family:Segoe UI,system-ui,sans-serif;background:#0f172a;color:#f8fafc;max-width:760px;margin:0 auto;padding:30px;}
    h1{color:#60a5fa;}
    .msg{margin:18px 0;padding:14px 16px;border-radius:12px;border:1px solid #334155;}
    .msg.user{background:#1e293b;}
    .msg.assistant{background:#111827;border-left:4px solid #2563eb;}
    .who{font-weight:700;margin-bottom:6px;color:#60a5fa;}
    .meta{color:#94a3b8;font-size:13px;margin-bottom:20px;}
  </style></head><body>
  <h1>The Ark AI</h1>
  <div class="meta">Conversation exported on ${new Date().toLocaleString()}</div>
  ${rows}
  </body></html>`;
}

function escapeHtml(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTxt(messages) {
  download(`the-ark-ai-${Date.now()}.txt`, buildPlainText(messages), "text/plain");
}

export function exportHtml(messages) {
  download(`the-ark-ai-${Date.now()}.html`, buildHtml(messages), "text/html");
}

// PDF via the browser print dialog (no external library needed)
export function exportPdf(messages) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(buildHtml(messages) + "<script>window.onload=()=>window.print()<\/script>");
  win.document.close();
}

// DOCX: build a markdown version and let the server package it
import { api } from "./api.js";
import { toast } from "./utils.js";
import { triggerDownload } from "./codeblock.js";

function buildMarkdown(messages) {
  const header = `# The Ark AI — Conversation\n\n_Exported ${new Date().toLocaleString()}_\n\n`;
  const body = messages
    .map((m) => `## ${m.role === "user" ? "You" : "The Ark AI"}\n\n${m.content}\n`)
    .join("\n");
  return header + body;
}

export async function exportDocx(messages) {
  try {
    toast("Building Word document…", "info");
    const { file } = await api.generateFile({
      content: buildMarkdown(messages),
      format: "docx",
      baseName: "the-ark-ai-conversation",
      title: "The Ark AI — Conversation",
    });
    triggerDownload(file.url, file.filename);
    toast("Word document ready", "success");
  } catch (e) {
    toast(e.message || "Could not create DOCX", "error");
  }
}
