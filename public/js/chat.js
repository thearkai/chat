// ==========================================================
//  Chat rendering & messaging engine
// ==========================================================
import { api, streamMessage } from "./api.js";
import { escapeHtml, toast, copyText, ICONS } from "./utils.js";
import { renderMarkdown, renderMarkdownStreaming } from "./markdown.js";
import { speak, stopSpeaking } from "./voice.js";
import { createCodeBlock, createDownloadCard } from "./codeblock.js";
import { detectDownloads } from "./downloads.js";

// Turn raw API/Gemini errors into short, friendly messages
function friendlyError(err) {
  const m = (err && err.message) || String(err || "");
  if (/429|Too Many Requests|quota|rate.?limit/i.test(m)) {
    const retry = m.match(/retry in ([\d.]+)s/i) || m.match(/retryDelay"?:?\s*"?(\d+)s/i);
    const wait = retry ? ` Please wait about ${Math.ceil(parseFloat(retry[1]))}s and try again.` : " Please wait a moment and try again.";
    return `⚠️ The AI is busy or the daily free quota has been reached.${wait}`;
  }
  if (/503|overloaded|UNAVAILABLE/i.test(m)) return "⚠️ The AI service is temporarily overloaded. Please try again shortly.";
  if (/API key|API_KEY|invalid authentication|UNAUTHENTICATED|401/i.test(m)) return "⚠️ The AI key is missing or invalid. Please check the server configuration.";
  if (/not configured/i.test(m)) return "⚠️ The AI service is not configured yet.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "⚠️ Network error. Please check your connection and try again.";
  return `⚠️ ${m || "Something went wrong. Please try again."}`;
}

export class ChatEngine {
  constructor({ scrollEl, user, useStreaming = true }) {
    this.scrollEl = scrollEl;
    this.user = user;
    this.useStreaming = useStreaming;
    this.messages = [];        // {role, content}
    this.chatId = null;
    this.busy = false;
  }

  setUser(user) { this.user = user; }
  reset(chatId = null) {
    this.messages = [];
    this.chatId = chatId;
    // Remove only the message elements; keep the #welcome node intact
    // so "New Chat" can show the welcome screen again.
    this.inner.querySelectorAll(".message").forEach((m) => m.remove());
  }

  loadMessages(messages, chatId) {
    this.reset(chatId);
    let prevUser = "";
    messages.forEach((m) => {
      this.messages.push({ role: m.role, content: m.content });
      const el = this._renderMessage(m.role, m.content);
      if (m.role === "user") prevUser = m.content;
      else this._enhance(el, m.content, prevUser);
    });
    this._scrollToBottom();
  }

  get inner() { return this.scrollEl.querySelector(".chat-inner"); }

  _scrollToBottom() {
    requestAnimationFrame(() => { this.scrollEl.scrollTop = this.scrollEl.scrollHeight; });
  }

  // ---------- Render a complete message ----------
  _renderMessage(role, content, { file } = {}) {
    const wrap = document.createElement("div");
    wrap.className = `message ${role} slide-up`;

    const avatar = role === "user" ? "U" : "";
    const logoSvg = `<svg width="20" height="20" viewBox="0 0 64 64" fill="none"><path d="M32 14 L46 46 H39 L32 28 L25 46 H18 Z" fill="#fff"/></svg>`;

    wrap.innerHTML = `
      <div class="msg-avatar">${role === "user" ? avatar : logoSvg}</div>
      <div class="msg-body">
        <div class="msg-role">${role === "user" ? "You" : "The Ark AI"}</div>
        ${file ? this._fileCardHtml(file) : ""}
        <div class="msg-content">${renderMarkdown(content)}</div>
        <div class="msg-actions"></div>
      </div>`;

    this.inner.appendChild(wrap);
    this._attachActions(wrap.querySelector(".msg-actions"), role, content, wrap);
    this._scrollToBottom();
    return wrap;
  }

  _fileCardHtml(file) {
    if (file.mimeType?.startsWith("image")) {
      return `<div class="file-card"><img src="${file.url}" alt="${escapeHtml(file.name)}"></div>`;
    }
    if (file.mimeType?.startsWith("video")) {
      return `<div class="file-card"><video src="${file.url}" controls></video></div>`;
    }
    return `<div class="file-card"><div class="file-icon">📄</div><div>${escapeHtml(file.name)}</div></div>`;
  }

  // ---------- Action buttons ----------
  _attachActions(container, role, getContent, wrap) {
    const content = () =>
      typeof getContent === "function" ? getContent() : (wrap.dataset.raw || getContent);

    if (role === "user") {
      const copy = this._actionBtn(ICONS.copy, "Copy", async () => {
        await copyText(content());
        toast("Prompt copied", "success");
      });
      container.appendChild(copy);
      return;
    }

    // assistant
    container.appendChild(this._actionBtn(ICONS.copy, "Copy", async (btn) => {
      await copyText(content());
      this._flash(btn, "Copied");
    }));
    container.appendChild(this._actionBtn(ICONS.regen, "Regenerate", () => {
      this.onRegenerate?.();
    }));
    container.appendChild(this._actionBtn(ICONS.share, "Share", async (btn) => {
      const text = content();
      if (navigator.share) {
        try { await navigator.share({ title: "The Ark AI", text }); } catch {}
      } else {
        await copyText(text);
        this._flash(btn, "Copied to share");
      }
    }));
    container.appendChild(this._actionBtn(ICONS.speak, "Read Aloud", (btn) => {
      if (btn.dataset.on === "1") { stopSpeaking(); btn.dataset.on = "0"; btn.classList.remove("done"); return; }
      speak(content());
      btn.dataset.on = "1"; btn.classList.add("done");
    }));
  }

  _actionBtn(icon, label, handler) {
    const b = document.createElement("button");
    b.className = "action-btn";
    b.innerHTML = `${icon}<span>${label}</span>`;
    b.addEventListener("click", () => handler(b));
    return b;
  }

  _flash(btn, text) {
    const span = btn.querySelector("span");
    const old = span.textContent;
    span.textContent = text;
    btn.classList.add("done");
    setTimeout(() => { span.textContent = old; btn.classList.remove("done"); }, 1500);
  }

  // ---------- Upgrade rendered markdown: rich code blocks + downloads ----------
  // Called once an assistant message has finished rendering.
  _enhance(msgEl, fullText, userPrompt = "") {
    const contentEl = msgEl.querySelector(".msg-content");
    if (!contentEl) return;

    // Replace tagged <pre.ark-code> with interactive editors
    contentEl.querySelectorAll("pre.ark-code").forEach((pre) => {
      const lang = pre.dataset.lang || "txt";
      let code = "";
      try { code = decodeURIComponent(pre.dataset.code || ""); } catch { code = pre.textContent; }
      const block = createCodeBlock(code, lang);
      pre.replaceWith(block);
    });

    // Offer downloadable documents when appropriate
    try {
      const offers = detectDownloads(fullText, userPrompt);
      if (offers.length) {
        const tray = document.createElement("div");
        tray.className = "download-tray";
        offers.forEach((o) => tray.appendChild(createDownloadCard(o)));
        contentEl.appendChild(tray);
      }
    } catch {}
  }

  // ---------- Thinking indicator ----------
  // Shows a spinning ring on the assistant avatar + an animated
  // status word that cycles "Thinking…" -> "Just a sec…".
  // Tracks start time so we can later show "Thought for Xs".
  _showThinking() {
    const wrap = document.createElement("div");
    wrap.className = "message assistant fade-in";
    wrap.id = "thinkingMsg";
    wrap.innerHTML = `
      <div class="msg-avatar thinking"><svg width="20" height="20" viewBox="0 0 64 64"><path d="M32 14 L46 46 H39 L32 28 L25 46 H18 Z" fill="#fff"/></svg></div>
      <div class="msg-body">
        <div class="msg-role">The Ark AI</div>
        <div class="thinking-status">
          <span class="word">Thinking</span><span class="ell"><i>.</i><i>.</i><i>.</i></span>
        </div>
      </div>`;
    this.inner.appendChild(wrap);
    this._scrollToBottom();

    // remember when thinking started
    wrap._startedAt = performance.now();

    // cycle the status word: Thinking -> Just a sec
    const wordEl = wrap.querySelector(".word");
    const phrases = ["Thinking", "Just a sec", "Almost there"];
    let idx = 0;
    wrap._statusTimer = setInterval(() => {
      idx = (idx + 1) % phrases.length;
      if (wordEl) wordEl.textContent = phrases[idx];
    }, 2200);

    return wrap;
  }

  // Elapsed seconds since a thinking indicator started
  _elapsed(thinking) {
    if (!thinking?._startedAt) return 0;
    return Math.max(1, Math.round((performance.now() - thinking._startedAt) / 1000));
  }

  // Stop the status word cycling
  _stopThinking(thinking) {
    if (thinking?._statusTimer) clearInterval(thinking._statusTimer);
  }

  // Prepend a "Thought for Xs" label to a finished assistant message
  _addThoughtLabel(msgEl, seconds) {
    if (!msgEl || !seconds) return;
    const body = msgEl.querySelector(".msg-body");
    const role = msgEl.querySelector(".msg-role");
    if (!body || !role) return;
    const label = document.createElement("div");
    label.className = "thought-label fade-in";
    label.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> Thought for ${seconds}s`;
    body.insertBefore(label, role.nextSibling);
  }

  // ---------- Send a message ----------
  async send(text, { file } = {}) {
    if (this.busy) return;
    if (!text && !file) return;
    this.busy = true;
    document.dispatchEvent(new CustomEvent("ark:busy", { detail: true }));

    // hide welcome
    const welcome = document.getElementById("welcome");
    if (welcome) welcome.classList.add("hidden");

    // render user message
    const userText = text || (file ? `📎 ${file.name}` : "");
    const uMsg = this._renderMessage("user", userText, { file });
    uMsg.dataset.raw = userText;
    this._lastPrompt = text || `Analyse the uploaded file: ${file?.name}`;
    this.messages.push({ role: "user", content: this._lastPrompt });

    const thinking = this._showThinking();

    try {
      if (file) {
        await this._handleFile(text, file, thinking);
      } else if (this.useStreaming) {
        await this._handleStream(text, thinking);
      } else {
        await this._handleStandard(text, thinking);
      }
    } catch (e) {
      this._stopThinking(thinking);
      thinking.remove();
      this._renderMessage("assistant", friendlyError(e));
    } finally {
      this.busy = false;
      document.dispatchEvent(new CustomEvent("ark:busy", { detail: false }));
      this.onUpdate?.();
    }
  }

  _historyForApi() {
    // Exclude the last user message (sent separately) and cap how much
    // history we send. Long saved conversations otherwise create a huge,
    // slow prompt (the cause of "fails to respond" after opening history).
    const MAX_TURNS = 12; // last 12 messages (~6 exchanges)
    const MAX_CHARS = 6000; // per-message safety trim
    return this.messages
      .slice(0, -1)
      .slice(-MAX_TURNS)
      .map((m) => ({
        role: m.role,
        content: String(m.content || "").slice(0, MAX_CHARS),
      }));
  }

  async _handleStandard(text, thinking) {
    const data = await api.sendMessage({
      message: text,
      history: this._historyForApi(),
      chatId: this.chatId,
    });
    const secs = this._elapsed(thinking);
    this._stopThinking(thinking);
    thinking.remove();
    this.chatId = data.chatId || this.chatId;
    this.messages.push({ role: "assistant", content: data.reply });
    const msg = this._renderMessage("assistant", "");
    this._addThoughtLabel(msg, secs);
    msg.dataset.raw = data.reply;
    await this._typeEffect(msg.querySelector(".msg-content"), data.reply);
    this._enhance(msg, data.reply, this._lastPrompt);
  }

  async _handleStream(text, thinking) {
    let acc = "";
    let msgEl = null;
    let contentEl = null;
    let secs = 0;
    let errored = false;

    await streamMessage(
      { message: text, history: this._historyForApi(), chatId: this.chatId },
      {
        onChunk: (chunk) => {
          if (!msgEl) {
            secs = this._elapsed(thinking);
            this._stopThinking(thinking);
            thinking.remove();
            msgEl = this._renderMessage("assistant", "");
            this._addThoughtLabel(msgEl, secs);
            contentEl = msgEl.querySelector(".msg-content");
            contentEl.classList.add("typing-cursor");
          }
          acc += chunk;
          contentEl.innerHTML = renderMarkdownStreaming(acc);
          msgEl.dataset.raw = acc;
          this._scrollToBottom();
        },
        onDone: (chatId) => {
          if (chatId) this.chatId = chatId;
          if (contentEl) {
            contentEl.classList.remove("typing-cursor");
            contentEl.innerHTML = renderMarkdown(acc);
          }
          this.messages.push({ role: "assistant", content: acc });
          if (msgEl) this._enhance(msgEl, acc, this._lastPrompt);
        },
        onError: (err) => {
          errored = true;
          this._stopThinking(thinking);
          this._lastError = err;
          if (!msgEl) { thinking.remove(); this._renderMessage("assistant", friendlyError(err)); }
          else { contentEl.classList.remove("typing-cursor"); }
        },
      }
    );

    // Only fall back to a non-streaming call when streaming produced
    // nothing AND there was no error (prevents a 2nd request on 429 etc.)
    if (!acc && !errored) {
      await this._handleStandard(text, this._showThinking());
    }
  }

  async _handleFile(text, fileObj, thinking) {
    const fd = new FormData();
    fd.append("file", fileObj.raw);
    if (text) fd.append("prompt", text);
    const data = await api.upload(fd);
    const secs = this._elapsed(thinking);
    this._stopThinking(thinking);
    thinking.remove();
    const reply = data.analysis || "File uploaded successfully.";
    this.messages.push({ role: "assistant", content: reply });
    const msg = this._renderMessage("assistant", "");
    this._addThoughtLabel(msg, secs);
    msg.dataset.raw = reply;
    await this._typeEffect(msg.querySelector(".msg-content"), reply);
    this._enhance(msg, reply, this._lastPrompt);
  }

  // ---------- Typing effect ----------
  async _typeEffect(el, fullText) {
    el.classList.add("typing-cursor");
    const speed = fullText.length > 1200 ? 4 : 12; // chars per tick
    let i = 0;
    return new Promise((resolve) => {
      const tick = () => {
        i += speed;
        el.innerHTML = renderMarkdownStreaming(fullText.slice(0, i));
        this._scrollToBottom();
        if (i < fullText.length) {
          requestAnimationFrame(() => setTimeout(tick, 12));
        } else {
          el.innerHTML = renderMarkdown(fullText);
          el.classList.remove("typing-cursor");
          resolve();
        }
      };
      tick();
    });
  }
}
