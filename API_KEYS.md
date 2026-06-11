# 🔑 API Keys — Where to Paste & How to Rotate

All keys live in **one file: `.env`** (in the project root). After editing `.env`, **restart the server** (`Ctrl+C` then `npm start`) for changes to take effect.

> 💡 Run `npm run check-setup` anytime to verify your keys are recognised.

---

## 1. OpenRouter key (main chat — REQUIRED)

**Line in `.env`:**
```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- Powers: chat, streaming, code generation, document content, PDF/TXT/HTML analysis.
- Get/rotate at: **https://openrouter.ai/keys**
- Does **not** expire on a timer (only changes if you delete/rotate it).

**To rotate (recommended after sharing a key):**
1. Go to https://openrouter.ai/keys → **delete** the old key → **Create Key**.
2. Copy the new `sk-or-v1-...` value.
3. In `.env`, replace **only** the part after `OPENROUTER_API_KEY=`.
4. Save → restart the server.

**To change the model** (e.g. if a free model is retired):
```env
OPENROUTER_MODEL=openai/gpt-oss-120b:free
```
Other good free options to try:
- `meta-llama/llama-3.3-70b-instruct:free`
- `google/gemma-4-31b-it:free`
- `z-ai/glm-4.5-air:free`

---

## 2. Gemini key (image/video analysis — OPTIONAL)

**Line in `.env`:**
```env
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
```

- Only used for **image/video** file analysis (the "vision" fallback). Chat does NOT need it while `AI_PROVIDER=openrouter`.
- Get at: **https://aistudio.google.com/app/apikey**
- ⚠️ Use a **permanent** key (starts with `AIzaSy...`). Short "express" tokens (start with `AQ.`) **expire quickly** and cause `401` errors.

---

## 3. Switching the chat provider

```env
# Options: openrouter | deepseek | gemini
AI_PROVIDER=openrouter
```
- `openrouter` → uses `OPENROUTER_API_KEY`
- `deepseek`  → uses `DEEPSEEK_API_KEY` (get at https://platform.deepseek.com)
- `gemini`    → uses `GEMINI_API_KEY`

---

## 4. Firebase & Cloudinary (already configured)

- **Firebase Admin:** either the `FIREBASE_*` vars in `.env`, **or** drop a `serviceAccountKey.json` in the project root (auto-detected — easiest, no newline issues).
- **Cloudinary:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Rotate the secret at https://cloudinary.com/console.

---

## ✅ After any key change

```bash
npm run check-setup     # confirms which keys are detected
npm start               # restart to apply
```
Look for `✔ FULLY READY` and, on boot, `✅ Firebase Admin initialised.`

> 🔒 **Security:** never commit `.env` (it's git-ignored). If a key is ever exposed, rotate it using the steps above.
