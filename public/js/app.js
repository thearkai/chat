// ==========================================================
//  THE ARK AI - Main application controller (index.html)
// ==========================================================
import { initFirebase, watchAuth, logout, isFirebaseEnabled } from "./firebase.js";
import { api } from "./api.js";
import { ChatEngine } from "./chat.js";
import { VoiceInput } from "./voice.js";
import { exportTxt, exportHtml, exportPdf, exportDocx } from "./export.js";
import { toast, initials } from "./utils.js";
import { bindThemeToggles } from "./theme.js";

const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  selectedFile: null,
};

// Declared before boot() so it's available during initial setup
// (const is not hoisted like a function declaration).
const isMobile = () => window.matchMedia("(max-width: 1024px)").matches;

let chat;
let voice;

// ---------------- Boot ----------------
(async function boot() {
  lockTitle();
  bindThemeToggles();

  const scrollEl = $("chatScroll");
  chat = new ChatEngine({ scrollEl, user: null, useStreaming: true });
  chat.onRegenerate = handleRegenerate;

  setupSidebar();
  setupComposer();
  setupVoice();
  setupExport();
  setupSuggestions();
  setupProfileMenu();

  // Firebase init is async but the UI is usable immediately (guest mode).
  await initFirebase();

  watchAuth(async (user) => {
    state.user = user;
    chat.setUser(user);
    updateProfileUI(user);
    if (user) await loadHistory();
    else renderGuestSidebar();
  });

  if (!isFirebaseEnabled()) {
    renderGuestSidebar();
    updateProfileUI(null);
  }
})();

// ---------------- Sidebar ----------------
function reflectSidebarState() {
  const app = $("app");
  const toggle = $("sidebarToggle");
  let shown;
  if (isMobile()) {
    shown = app.classList.contains("sidebar-open");
  } else {
    shown = !app.classList.contains("sidebar-collapsed");
  }
  app.classList.toggle("sidebar-shown", shown);
  toggle?.setAttribute("aria-expanded", String(shown));
  toggle?.setAttribute("title", shown ? "Close sidebar" : "Open sidebar");
  toggle?.setAttribute("aria-label", shown ? "Close sidebar" : "Open sidebar");
}

function closeMobileSidebar() {
  $("app").classList.remove("sidebar-open");
  $("overlay").classList.remove("show");
  reflectSidebarState();
}

function setupSidebar() {
  const app = $("app");
  const toggle = $("sidebarToggle");
  const overlay = $("overlay");

  reflectSidebarState();
  window.addEventListener("resize", reflectSidebarState);

  toggle?.addEventListener("click", () => {
    if (isMobile()) {
      app.classList.toggle("sidebar-open");
      overlay.classList.toggle("show", app.classList.contains("sidebar-open"));
    } else {
      app.classList.toggle("sidebar-collapsed");
    }
    reflectSidebarState();
  });

  overlay?.addEventListener("click", closeMobileSidebar);

  // Close the mobile sidebar with Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isMobile()) closeMobileSidebar();
  });

  $("newChatBtn")?.addEventListener("click", startNewChat);

  $("logoutBtn")?.addEventListener("click", doLogout);
  $("settingsBtn")?.addEventListener("click", () => (location.href = "/settings"));
}

// New Chat -> clears conversation AND returns to the welcome screen
function startNewChat() {
  chat.reset();
  const welcome = $("welcome");
  if (welcome) welcome.classList.remove("hidden");
  document.querySelectorAll(".history-item").forEach((i) => i.classList.remove("active"));
  $("messageInput")?.focus();
  if (isMobile()) closeMobileSidebar();
}

async function doLogout() {
  await logout();
  toast("Logged out", "success");
  setTimeout(() => location.reload(), 500);
}

async function loadHistory() {
  const list = $("chatHistory");
  if (!list) return;
  try {
    const { chats } = await api.listChats();
    if (!chats.length) { renderGuestSidebar("No conversations yet."); return; }
    list.innerHTML = `<div class="history-label">Recent</div>` +
      chats.map((c) => `
        <div class="history-item" data-id="${c.chatId}" tabindex="0" role="button" aria-label="Open conversation: ${escapeHtmlLite(c.title || "Chat")}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span class="title">${escapeHtmlLite(c.title || "Chat")}</span>
          <button class="del" title="Delete conversation" aria-label="Delete conversation">×</button>
        </div>`).join("");

    list.querySelectorAll(".history-item").forEach((item) => {
      const open = (e) => {
        if (e.target.classList.contains("del")) return;
        openChat(item.dataset.id, item);
      };
      item.addEventListener("click", open);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); }
      });
      item.querySelector(".del").addEventListener("click", async (e) => {
        e.stopPropagation();
        await api.deleteChat(item.dataset.id);
        item.remove();
        toast("Conversation deleted", "success");
      });
    });
  } catch (e) {
    console.error("History load failed:", e);
    renderGuestSidebar(`Could not load history. ${e.message || ""}`.trim());
  }
}

async function openChat(chatId, item) {
  document.querySelectorAll(".history-item").forEach((i) => i.classList.remove("active"));
  item?.classList.add("active");
  $("welcome")?.classList.add("hidden");
  try {
    const { messages } = await api.getMessages(chatId);
    chat.loadMessages(messages, chatId);
  } catch (e) {
    toast("Failed to open conversation", "error");
  }
  if (isMobile()) closeMobileSidebar();
}

function renderGuestSidebar(msg) {
  const list = $("chatHistory");
  if (!list) return;
  list.innerHTML = `<div class="history-label">History</div>
    <div style="padding:14px;color:var(--text-muted);font-size:13px;line-height:1.6;">
      ${msg || (state.user ? "No conversations yet." : "Log in to save your chat history.")}
    </div>`;
}

// ---------------- Composer ----------------
function setupComposer() {
  const ta = $("messageInput");
  const sendBtn = $("sendBtn");

  const autosize = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 180) + "px"; };
  ta.addEventListener("input", autosize);

  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  sendBtn.addEventListener("click", submit);

  const fileInput = $("fileInput");
  $("attachBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (state.selectedFile?.url) URL.revokeObjectURL(state.selectedFile.url);
    state.selectedFile = {
      raw: f, name: f.name, mimeType: f.type, size: f.size,
      url: URL.createObjectURL(f),
      isImage: f.type.startsWith("image/"),
    };
    renderAttachment();
  });

  document.addEventListener("ark:busy", (e) => {
    const busy = e.detail;
    sendBtn.disabled = busy;
    // NOTE: the loading animation is shown on the last assistant
    // message's avatar (handled in chat.js), NOT on the header logo.
  });
}

function humanSize(bytes = 0) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// Render the in-composer attachment preview (image widens; loader while uploading)
function renderAttachment() {
  const wrap = $("composerAttachments");
  const f = state.selectedFile;
  if (!f) { wrap.classList.add("hidden"); wrap.innerHTML = ""; return; }

  wrap.classList.remove("hidden");
  const visual = f.isImage
    ? `<img class="thumb wide" src="${f.url}" alt="Preview of ${escapeHtmlLite(f.name)}" />`
    : `<div class="doc-icon" aria-hidden="true">📄</div>`;

  wrap.innerHTML = `
    <div class="attach-preview ${f.isImage ? "wideframe" : ""}" id="attachPreview">
      ${visual}
      <div class="upload-overlay"><span class="spiral-loader sm"></span></div>
      <div class="meta">
        <span class="fname">${escapeHtmlLite(f.name)}</span>
        <span class="fsize">${humanSize(f.size)}</span>
      </div>
      <button class="close" id="removeAttach" title="Remove file" aria-label="Remove file">×</button>
    </div>`;

  $("removeAttach").addEventListener("click", clearAttachment);
}

function setAttachmentUploading(on) {
  const p = $("attachPreview");
  if (p) p.classList.toggle("uploading", on);
}

function clearAttachment() {
  if (state.selectedFile?.url) URL.revokeObjectURL(state.selectedFile.url);
  state.selectedFile = null;
  $("composerAttachments").classList.add("hidden");
  $("composerAttachments").innerHTML = "";
  $("fileInput").value = "";
}

async function submit() {
  const ta = $("messageInput");
  const text = ta.value.trim();
  const file = state.selectedFile;
  if (!text && !file) return;

  ta.value = "";
  ta.style.height = "auto";

  // show the spiral loader on the preview while the file uploads
  if (file) setAttachmentUploading(true);

  // keep a reference, clear the picker visually only after send starts
  const fileToSend = file;

  try {
    await chat.send(text, { file: fileToSend });
  } finally {
    clearAttachment();
  }
}

function handleRegenerate() {
  const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return;
  const msgs = chat.inner.querySelectorAll(".message.assistant");
  if (msgs.length) msgs[msgs.length - 1].remove();
  chat.messages = chat.messages.filter((m, i) => !(m.role === "assistant" && i === chat.messages.length - 1));
  chat.send(lastUser.content);
}

// ---------------- Voice ----------------
function setupVoice() {
  const ta = $("messageInput");
  const micBtn = $("micBtn");
  const indicator = $("voiceIndicator");

  voice = new VoiceInput({
    onResult: (transcript) => { ta.value = transcript; },
    onAutoSubmit: () => { if (ta.value.trim()) submit(); },
    onStateChange: (listening) => {
      micBtn.classList.toggle("recording", listening);
      micBtn.setAttribute("aria-pressed", String(listening));
      indicator.classList.toggle("hidden", !listening);
    },
  });

  micBtn.addEventListener("click", () => voice.toggle());
}

// ---------------- Export ----------------
function setupExport() {
  const btn = $("exportBtn");
  const menu = $("exportMenu");
  const setOpen = (open) => {
    menu.classList.toggle("hidden", !open);
    btn.setAttribute("aria-expanded", String(open));
  };
  btn?.addEventListener("click", (e) => { e.stopPropagation(); setOpen(menu.classList.contains("hidden")); });
  document.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  $("exportTxt")?.addEventListener("click", () => guardExport(exportTxt));
  $("exportHtml")?.addEventListener("click", () => guardExport(exportHtml));
  $("exportPdf")?.addEventListener("click", () => guardExport(exportPdf));
  $("exportDocx")?.addEventListener("click", () => guardExport(exportDocx));
}
function guardExport(fn) {
  if (!chat.messages.length) return toast("Nothing to export yet.", "error");
  fn(chat.messages);
}

// ---------------- Suggestions ----------------
// Generic prompts: open the chat and focus the input, letting the user decide.
function setupSuggestions() {
  document.querySelectorAll(".suggestion").forEach((s) => {
    s.addEventListener("click", () => {
      const prompt = (s.dataset.prompt || "").trim();
      const ta = $("messageInput");
      $("welcome")?.classList.add("hidden");
      if (prompt) {
        ta.value = prompt;
        submit();
      } else {
        // No preset topic — just open the input for the user to type
        ta.focus();
      }
    });
  });
}

// ---------------- Profile ----------------
function setupProfileMenu() {
  $("profileChip")?.addEventListener("click", () => {
    location.href = state.user ? "/settings" : "/login";
  });
}

function updateProfileUI(user) {
  const name = user?.displayName || (user ? user.email : "Guest");
  $("profileName").textContent = name;
  $("profileAvatar").textContent = user ? initials(name) : "G";

  // Only the login/logout part changes here — the Settings and Dark-mode
  // links live separately in the sidebar footer and are never touched.
  const acc = $("accountSection");
  if (acc) {
    acc.innerHTML = user
      ? `<button class="sidebar-link" id="logoutBtn">🚪 Logout</button>`
      : `<a class="sidebar-link" href="/login">🔑 Login</a>
         <a class="sidebar-link" href="/signup">✨ Create Account</a>`;
    $("logoutBtn")?.addEventListener("click", doLogout);
  }
}

// Keep the browser tab title fixed ("The Ark AI"). Some environments/
// extensions can overwrite document.title with page content; this guard
// pins it back so the conversation never leaks into the tab/header.
function lockTitle() {
  const TITLE = "The Ark AI";
  document.title = TITLE;
  try {
    const obs = new MutationObserver(() => {
      if (document.title !== TITLE) document.title = TITLE;
    });
    const titleEl = document.querySelector("title");
    if (titleEl) obs.observe(titleEl, { childList: true });
  } catch { /* MutationObserver unavailable – the initial set still applies */ }
}

function escapeHtmlLite(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
