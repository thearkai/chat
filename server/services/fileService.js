// ==========================================================
//  File generation service
//  Turns AI-generated TEXT content into real downloadable
//  files: TXT, MD, HTML, JSON, CSV, source-code files,
//  DOCX (via "docx") and PDF (via "pdfkit").
//
//  NOTE: Text models (Gemini) cannot emit binary office files
//  directly. The model produces the CONTENT; this service
//  packages it into a proper file the user can download.
// ==========================================================
import fs from "fs";
import path from "path";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import PDFDocument from "pdfkit";
import { env } from "../config/env.js";

const OUT_DIR = path.join(env.uploads.dir, "generated");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Map "language" -> file extension for code downloads
const CODE_EXT = {
  javascript: "js", js: "js", typescript: "ts", ts: "ts",
  python: "py", py: "py", java: "java", c: "c", cpp: "cpp", "c++": "cpp",
  csharp: "cs", cs: "cs", go: "go", rust: "rs", php: "php", ruby: "rb",
  swift: "swift", kotlin: "kt", html: "html", css: "css", json: "json",
  sql: "sql", bash: "sh", shell: "sh", sh: "sh", yaml: "yml", yml: "yml",
  markdown: "md", md: "md", xml: "xml", text: "txt", txt: "txt",
};

const TEXT_FORMATS = { txt: "txt", md: "md", html: "html", json: "json", csv: "csv", xml: "xml" };

function safeName(base = "the-ark-ai") {
  return base.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 60) || "file";
}
function uniqueName(name) {
  return `${Date.now()}-${Math.round(Math.random() * 1e5)}-${name}`;
}
function write(buffer, filename) {
  const finalName = uniqueName(safeName(filename));
  const full = path.join(OUT_DIR, finalName);
  fs.writeFileSync(full, buffer);
  return {
    filename: finalName,
    url: `/uploads/generated/${finalName}`,
    size: Buffer.byteLength(buffer),
  };
}

// ---------- Plain / text-like files ----------
export function generateText(content, format = "txt", baseName = "the-ark-ai") {
  const ext = TEXT_FORMATS[format] || "txt";
  return write(Buffer.from(content ?? "", "utf-8"), `${baseName}.${ext}`);
}

// ---------- Source code files ----------
export function generateCode(code, language = "txt", baseName = "snippet") {
  const ext = CODE_EXT[(language || "").toLowerCase()] || "txt";
  return write(Buffer.from(code ?? "", "utf-8"), `${baseName}.${ext}`);
}

// ---------- Markdown -> very small AST -> DOCX ----------
function markdownToDocxParagraphs(md = "") {
  const lines = String(md).split("\n");
  const paras = [];
  let inCode = false;
  let codeBuffer = [];

  const pushInline = (text, opts = {}) => {
    // bold (**), inline code (`)
    const runs = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0, m;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), ...opts }));
      const tok = m[0];
      if (tok.startsWith("**")) runs.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...opts }));
      else runs.push(new TextRun({ text: tok.slice(1, -1), font: "Consolas", ...opts }));
      last = m.index + tok.length;
    }
    if (last < text.length) runs.push(new TextRun({ text: text.slice(last), ...opts }));
    return runs.length ? runs : [new TextRun({ text, ...opts })];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        codeBuffer.forEach((c) =>
          paras.push(new Paragraph({ children: [new TextRun({ text: c, font: "Consolas", size: 20 })], shading: { fill: "F1F5F9" } }))
        );
        codeBuffer = []; inCode = false;
      } else inCode = true;
      continue;
    }
    if (inCode) { codeBuffer.push(line); continue; }

    if (/^#\s+/.test(line)) paras.push(new Paragraph({ text: line.replace(/^#\s+/, ""), heading: HeadingLevel.HEADING_1 }));
    else if (/^##\s+/.test(line)) paras.push(new Paragraph({ text: line.replace(/^##\s+/, ""), heading: HeadingLevel.HEADING_2 }));
    else if (/^###\s+/.test(line)) paras.push(new Paragraph({ text: line.replace(/^###\s+/, ""), heading: HeadingLevel.HEADING_3 }));
    else if (/^[-*]\s+/.test(line)) paras.push(new Paragraph({ children: pushInline(line.replace(/^[-*]\s+/, "")), bullet: { level: 0 } }));
    else if (/^\d+\.\s+/.test(line)) paras.push(new Paragraph({ children: pushInline(line.replace(/^\d+\.\s+/, "")), numbering: undefined, bullet: { level: 0 } }));
    else if (line.trim() === "") paras.push(new Paragraph({ text: "" }));
    else paras.push(new Paragraph({ children: pushInline(line) }));
  }
  if (codeBuffer.length) codeBuffer.forEach((c) => paras.push(new Paragraph({ children: [new TextRun({ text: c, font: "Consolas", size: 20 })] })));
  return paras;
}

export async function generateDocx(content, baseName = "the-ark-ai", title = "The Ark AI Document") {
  const doc = new Document({
    creator: "The Ark AI",
    title,
    sections: [{
      children: [
        new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
        new Paragraph({ text: "" }),
        ...markdownToDocxParagraphs(content),
      ],
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  return write(buffer, `${baseName}.docx`);
}

// ---------- PDF ----------
export function generatePdf(content, baseName = "the-ark-ai", title = "The Ark AI Document") {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 56 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(write(Buffer.concat(chunks), `${baseName}.pdf`)));
      doc.on("error", reject);

      doc.fontSize(20).fillColor("#2563eb").text(title, { underline: false });
      doc.moveDown(0.6);
      doc.fontSize(11).fillColor("#94a3b8").text(new Date().toLocaleString());
      doc.moveDown(1);
      doc.fillColor("#0f172a").fontSize(12);

      String(content).split("\n").forEach((line) => {
        let text = line, opts = {};
        if (/^#\s+/.test(line)) { doc.moveDown(0.4).fontSize(17); text = line.replace(/^#\s+/, ""); }
        else if (/^##\s+/.test(line)) { doc.moveDown(0.3).fontSize(15); text = line.replace(/^##\s+/, ""); }
        else if (/^###\s+/.test(line)) { doc.moveDown(0.2).fontSize(13); text = line.replace(/^###\s+/, ""); }
        else if (/^[-*]\s+/.test(line)) { text = "•  " + line.replace(/^[-*]\s+/, ""); doc.fontSize(12); }
        else doc.fontSize(12);
        text = text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
        doc.text(text, opts);
      });

      doc.end();
    } catch (e) { reject(e); }
  });
}

// ---------- Unified dispatcher ----------
export async function generateFile({ content, format = "txt", language, baseName = "the-ark-ai", title }) {
  switch ((format || "txt").toLowerCase()) {
    case "docx": return await generateDocx(content, baseName, title);
    case "pdf": return await generatePdf(content, baseName, title);
    case "code": return generateCode(content, language, baseName);
    case "txt": case "md": case "html": case "json": case "csv": case "xml":
      return generateText(content, format, baseName);
    default: return generateText(content, "txt", baseName);
  }
}

// What this server can produce (advertised to the client/AI)
export const CAPABILITIES = {
  text: ["txt", "md", "html", "json", "csv", "xml"],
  documents: ["docx", "pdf"],
  code: Object.keys(CODE_EXT),
  images: false, // requires an image model; disabled per configuration
};
