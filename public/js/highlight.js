// ==========================================================
//  Tiny dependency-free syntax highlighter.
//  Supports common tokens for JS/TS, Python, HTML, CSS, JSON,
//  and generic C-like languages. Good enough for a clean,
//  readable code editor without shipping a heavy library.
// ==========================================================

function esc(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const KEYWORDS = {
  js: "const let var function return if else for while do switch case break continue new class extends super import export from default async await try catch finally throw typeof instanceof of in this null undefined true false yield static get set",
  ts: "const let var function return if else for while do switch case break continue new class extends super import export from default async await try catch finally throw typeof instanceof of in this null undefined true false interface type enum implements public private protected readonly as namespace",
  python: "def return if elif else for while break continue class import from as try except finally raise with lambda yield global nonlocal pass None True False and or not in is assert del async await",
  java: "public private protected class interface extends implements return if else for while do switch case break continue new static final void int double float boolean char long short try catch finally throw throws import package this super null true false abstract",
  css: "",
  html: "",
  json: "",
  c: "int char float double void return if else for while do switch case break continue struct typedef const static sizeof include define unsigned signed long short enum union goto",
};
KEYWORDS.cpp = KEYWORDS.c + " class public private protected new delete namespace using template virtual try catch throw bool true false nullptr";
KEYWORDS.go = "func package import return if else for range var const type struct interface map chan go defer select switch case break continue nil true false";
KEYWORDS.rust = "fn let mut const struct enum impl trait pub use mod match if else for while loop return self Self where as ref move dyn async await true false";

export function normalizeLang(lang = "") {
  const l = lang.toLowerCase();
  if (["javascript", "jsx", "node"].includes(l)) return "js";
  if (["typescript", "tsx"].includes(l)) return "ts";
  if (["py"].includes(l)) return "python";
  if (["c++", "cc"].includes(l)) return "cpp";
  if (["sh", "shell", "zsh"].includes(l)) return "bash";
  return l;
}

// Web-renderable languages eligible for live preview
export const PREVIEWABLE = new Set(["html", "svg"]);

export function isPreviewable(lang) {
  return PREVIEWABLE.has(normalizeLang(lang));
}

export function highlight(code, lang) {
  const l = normalizeLang(lang);
  let html = esc(code);

  // Order matters: protect strings & comments first using placeholders
  const store = [];
  const stash = (cls, text) => { store.push(`<span class="tok-${cls}">${text}</span>`); return `\u0000${store.length - 1}\u0000`; };

  // strings (single, double, backtick)
  html = html.replace(/(&quot;|&#39;|`)(?:\\.|(?!\1).)*\1/g, (m) => stash("str", m));

  // comments
  if (["js", "ts", "java", "c", "cpp", "go", "rust", "css"].includes(l)) {
    html = html.replace(/\/\/[^\n]*/g, (m) => stash("com", m));
    html = html.replace(/\/\*[\s\S]*?\*\//g, (m) => stash("com", m));
  }
  if (["python", "bash"].includes(l)) {
    html = html.replace(/#[^\n]*/g, (m) => stash("com", m));
  }

  // numbers
  html = html.replace(/\b(0x[\da-fA-F]+|\d+\.?\d*)\b/g, (m) => stash("num", m));

  // keywords
  const kw = (KEYWORDS[l] || "").split(/\s+/).filter(Boolean);
  if (kw.length) {
    const re = new RegExp(`\\b(${kw.join("|")})\\b`, "g");
    html = html.replace(re, (m) => stash("kw", m));
  }

  // function calls (word followed by "(")
  html = html.replace(/\b([A-Za-z_]\w*)(\s*\()/g, (m, name, paren) => stash("fn", name) + paren);

  // restore placeholders
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => store[+i]);
  return html;
}
