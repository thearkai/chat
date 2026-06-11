// ==========================================================
//  Voice features: Speech Recognition + Text-to-Speech
// ==========================================================
import { toast } from "./utils.js";

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export class VoiceInput {
  constructor({ onResult, onAutoSubmit, onStateChange }) {
    this.supported = !!SR;
    this.listening = false;
    this.onResult = onResult;
    this.onAutoSubmit = onAutoSubmit;
    this.onStateChange = onStateChange;
    this.silenceTimer = null;

    if (this.supported) {
      this.rec = new SR();
      this.rec.continuous = true;
      this.rec.interimResults = true;
      this.rec.lang = "en-US";

      this.rec.onresult = (e) => {
        let transcript = "";
        for (let i = 0; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        this.onResult?.(transcript);
        this._resetSilenceTimer();
      };
      this.rec.onerror = (e) => {
        if (e.error !== "no-speech") toast(`Voice error: ${e.error}`, "error");
        this.stop();
      };
      this.rec.onend = () => {
        if (this.listening) { try { this.rec.start(); } catch {} }
      };
    }
  }

  _resetSilenceTimer() {
    // Auto-submit after 3 seconds of inactivity
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (this.listening) {
        this.stop();
        this.onAutoSubmit?.();
      }
    }, 3000);
  }

  start() {
    if (!this.supported) { toast("Speech recognition is not supported in this browser.", "error"); return; }
    if (this.listening) return;
    this.listening = true;
    try { this.rec.start(); } catch {}
    this.onStateChange?.(true);
    this._resetSilenceTimer();
  }

  stop() {
    this.listening = false;
    clearTimeout(this.silenceTimer);
    try { this.rec && this.rec.stop(); } catch {}
    this.onStateChange?.(false);
  }

  toggle() { this.listening ? this.stop() : this.start(); }
}

// ---- Text-to-Speech ----
let currentUtterance = null;
export function speak(text) {
  if (!("speechSynthesis" in window)) { toast("Text-to-speech not supported.", "error"); return; }
  stopSpeaking();
  const clean = text.replace(/[*#`>_]/g, "");
  currentUtterance = new SpeechSynthesisUtterance(clean);
  currentUtterance.rate = 1;
  currentUtterance.pitch = 1;
  currentUtterance.lang = "en-US";
  window.speechSynthesis.speak(currentUtterance);
}
export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  currentUtterance = null;
}
export function isSpeaking() {
  return "speechSynthesis" in window && window.speechSynthesis.speaking;
}
