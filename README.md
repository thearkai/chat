# 🛟 The Ark AI

![The Ark AI](public/assets/banner.png)

**The Ark AI** is a production-ready, ChatGPT-inspired AI assistant built for **students, researchers, and curious learners**. It provides conversational AI, voice interaction, file analysis, content generation, and intelligent learning assistance — powered by **Google Gemini**.

> Designed to be clean, scalable, modular, and perfect for a **secondary-school science-fair demonstration** — yet robust enough for real deployment. By : SYSON ACTIN

---

## ✨ Features

| Category | What you get |
|---|---|
| 💬 **Conversational AI** | Google Gemini integration with **streaming responses**, typing effect, thinking animation, error handling & auto-scroll |
| 🎤 **Voice** | Speech-to-text input, **auto-submit after 3s of silence**, text-to-speech "Read Aloud" |
| 📎 **File analysis** | Upload & analyse **PDF, TXT, HTML, PNG, JPG/JPEG, MP4** with preview |
| 👤 **Auth** | Email/password + **Google Sign-In** (guest mode also supported) |
| 🗂️ **History** | Saved chats for registered users (Firestore); guests chat freely without saving |
| 🧩 **Response actions** | Copy, Regenerate, Share, Read Aloud on every AI reply; Copy on every prompt |
| 📤 **Export** | Download conversations as **PDF, Word (.docx), TXT, HTML** |
| 🧑‍💻 **Code editor** | AI code replies render in a rich editor with **syntax highlighting, Copy, Share, Download**, and **live Preview** (HTML/CSS/JS) in a side panel |
| 📥 **AI file generation** | AI content can be packaged into **downloadable files**: DOCX, PDF, TXT, MD, HTML, JSON, CSV + source-code files, returned as a download link |
| 🎨 **UI/UX** | Modern blue-and-black theme, animated logo, smooth transitions, fully responsive |
| 🔐 **Security** | `.env` secrets, input/file validation, rate limiting, secure Firebase rules |

---

## 🧱 Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules)
- **Backend:** Node.js + Express.js (MVC)
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication
- **AI:** Google Gemini API
- **File storage:** Local `uploads/` folder + optional Cloudinary

---

## 📁 Folder Structure

```
the-ark-ai/
├── server/                     # Backend (MVC)
│   ├── config/                 # env, firebase, cloudinary
│   ├── controllers/            # auth, chat, upload, user
│   ├── routes/                 # API route definitions
│   ├── services/               # geminiService, firestoreService
│   ├── middleware/             # auth, upload, rateLimiter, errorHandler
│   ├── utils/                  # logger, apiResponse, validators
│   ├── uploads/                # local file uploads
│   └── server.js               # Express entry point
│
├── public/                     # Frontend (served statically)
│   ├── css/                    # theme, animations, main, auth
│   ├── js/                     # ES6 modules (app, chat, voice, etc.)
│   ├── assets/                 # logo + banner
│   ├── components/             # (reserved for future components)
│   ├── index.html              # main chat app
│   ├── login.html
│   ├── signup.html
│   └── settings.html
│
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json      # Composite indexes
├── firebase.json
├── .env.example                # Environment template
├── package.json
└── README.md
```

---

## 🚀 Quick Start (Installation)

### 1. Prerequisites
- **Node.js 18+** and npm
- A **Google Gemini API key** → https://aistudio.google.com/app/apikey
- A **Firebase project** (optional but needed for login + history)

### 2. Install
```bash
cd the-ark-ai
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Open `.env` and fill in your keys (see the **Environment Variables** section below).

> 💡 **Minimum to run:** just set `GEMINI_API_KEY`. Without Firebase, the app runs in **guest-only mode** (chat works, history is not saved). This is great for a quick science-fair demo.

### 4. Run
```bash
npm run dev      # development (auto-reload via nodemon)
# or
npm start        # production
```

Open **http://localhost:5000** 🎉

---

## 🔑 Environment Variables

All secrets live in `.env` (never commit this file).

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5000

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Firebase Admin (backend)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Web (frontend — public keys)
FIREBASE_API_KEY=your_web_api_key
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Uploads
MAX_FILE_SIZE_MB=25

# Cloudinary (optional)
USE_CLOUDINARY=false
```

---

## 🔥 Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com) → **Create project**.
2. **Authentication → Sign-in method:** enable **Email/Password** and **Google**.
3. **Firestore Database → Create database** (start in production mode).
4. **Project Settings → General → Your apps → Web app:** copy the web config into the `FIREBASE_*` web variables in `.env`.
5. **Project Settings → Service Accounts → Generate new private key** (downloads a JSON). You have **two ways** to give it to the app:

   **Option A — JSON file (easiest, recommended):**
   Save the downloaded file as **`serviceAccountKey.json`** in the project root. That's it — the app auto-detects and uses it, with no newline escaping to worry about. (Optionally set `FIREBASE_SERVICE_ACCOUNT=/path/to/file.json` for a custom location.) The file is git-ignored.

   **Option B — .env variables:**
   Copy `project_id`, `client_email`, and `private_key` into the `FIREBASE_*` admin variables. Keep the private key on one line with literal `\n` characters, wrapped in double quotes.
6. Add your domain to **Authentication → Settings → Authorized domains** (e.g. `localhost`, your production domain).
7. Deploy the security rules:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```

### Database collections
| Collection | Fields |
|---|---|
| `users` | `uid`, `username`, `email`, `gender`, `dateOfBirth`, `createdAt` |
| `chats` | `chatId`, `uid`, `title`, `createdAt` |
| `messages` | `messageId`, `chatId`, `role`, `content`, `timestamp` |

---

## 📥 AI File Generation & Code Editor

**How downloadable files work:** text AI models (Gemini) return *text*, not binary office files. The Ark AI's backend (`server/services/fileService.js`) takes the AI-generated content and **packages it into real files** the user can download:

| Type | Library / method |
|---|---|
| DOCX (Word) | [`docx`](https://www.npmjs.com/package/docx) |
| PDF | [`pdfkit`](https://www.npmjs.com/package/pdfkit) |
| TXT, MD, HTML, JSON, CSV, XML | native |
| Source code (.py, .js, .java, …) | native, by language |

Generated files are saved to `server/uploads/generated/` and served via a download link. Ask things like *"write a report and give me a Word doc"* or *"make a PDF of this"* and a download card appears under the reply.

**Code editor:** when the AI returns fenced code blocks, they render in a styled editor with **Copy / Share / Download** and — for HTML/SVG — a **▶ Preview** button that opens a sandboxed live render in a side panel.

> ⚠️ **Image generation is intentionally disabled** (`CAPABILITIES.images = false`). Text models can't create images; that requires an image model (`imagen` / `gemini-*-image`) and a permanent key. The API advertises its real capabilities at `GET /api/generate/capabilities`.

> ⚠️ **API key note:** use a **permanent** Google AI Studio key (starts with `AIzaSy…`) from https://aistudio.google.com/app/apikey. Short "express" tokens (starting with `AQ.`) **expire** and will cause `401 UNAUTHENTICATED` errors.

## 🤖 Gemini API Integration

- Implemented in `server/services/geminiService.js`.
- Supports **standard** and **streaming** chat, plus **multimodal file analysis** (text, PDF, image, video).
- A friendly system prompt tailors responses for learners.
- Swap models with `GEMINI_MODEL` (e.g. `gemini-1.5-flash`, `gemini-1.5-pro`).

---

## 🧪 API Reference (summary)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | – | Server status |
| GET | `/api/config` | – | Public client config |
| POST | `/api/chat/message` | optional | Get an AI reply |
| POST | `/api/chat/stream` | optional | Streamed AI reply (SSE) |
| GET | `/api/chat/list` | ✅ | List user chats |
| GET | `/api/chat/:chatId/messages` | ✅ | Messages in a chat |
| DELETE | `/api/chat/:chatId` | ✅ | Delete a chat |
| POST | `/api/upload` | optional | Upload + analyse a file |
| POST | `/api/auth/sync` | ✅ | Sync profile after auth |
| GET/PUT | `/api/user/profile` | ✅ | Read / update profile |

---

## 🎤 Voice, 📎 Files & 📤 Export

- **Voice:** uses the browser **Web Speech API** (`SpeechRecognition` + `speechSynthesis`). Best in Chrome/Edge.
- **Files:** validated by type & size on both client and server; previewed inline; analysed by Gemini.
- **Export:** TXT and HTML download instantly; PDF uses the browser print dialog (no extra dependency).

---

## 📱 Responsive Design

| Device | Behaviour |
|---|---|
| **Desktop** | Full sidebar visible |
| **Tablet** | Collapsible sidebar (slide-in) |
| **Mobile** | Hidden sidebar with toggle button + overlay |

---

## ☁️ Deployment Guide

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for full instructions (Render, Railway, Fly.io, VPS, Docker).

**Quick version (Render / Railway):**
1. Push the repo to GitHub.
2. Create a new **Web Service**, build command `npm install`, start command `npm start`.
3. Add all `.env` variables in the dashboard.
4. Set `CLIENT_ORIGIN` and Firebase **Authorized domains** to your deployed URL.

> ⚠️ Local `uploads/` is ephemeral on most PaaS hosts. Enable **Cloudinary** (`USE_CLOUDINARY=true`) for persistent media in production.

---

## 🔐 Security Notes

- All secrets in `.env` (git-ignored).
- Server-side **input & file validation** + **rate limiting** (`/api` and stricter AI limiter).
- **Firebase ID tokens** verified by the Admin SDK on every protected route.
- **Firestore rules** ensure users only access their own data.
- `helmet` security headers + configurable **CORS**.

---

## 🔑 Managing API Keys

See **[API_KEYS.md](API_KEYS.md)** for exactly where to paste each key and how to rotate them. Quick reference:

| Key | `.env` variable | Where to get / rotate |
|---|---|---|
| OpenRouter (main chat) | `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| Gemini (image/video only) | `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey |
| DeepSeek (alt provider) | `DEEPSEEK_API_KEY` | https://platform.deepseek.com |

After changing any key: `npm run check-setup` then restart with `npm start`.

---

## 🧯 Troubleshooting

| Problem | Fix |
|---|---|
| "AI service is not configured" | Set `GEMINI_API_KEY` in `.env` |
| Login does nothing | Configure Firebase web + admin vars; add domain to Authorized domains |
| Firebase "Invalid PEM" / `DECODER routines::unsupported` | The private key is malformed. **Easiest fix:** drop your downloaded `serviceAccountKey.json` in the project root (the app uses it automatically). Or wrap `FIREBASE_PRIVATE_KEY` in double quotes with literal `\n`. |
| Voice not working | Use Chrome/Edge over HTTPS (or localhost) |
| History empty | Only saved for logged-in users; guests don't save |

---

## 🏫 Science-Fair Demo Script

1. Open the app → show the **animated welcome screen**.
2. Click a suggestion → watch the **thinking dots → typing effect**.
3. Use the **microphone** → speak → it auto-sends after 3s.
4. Click **Read Aloud** on a reply.
5. **Upload a PDF/image** → show Gemini's analysis.
6. **Sign up** → send a message → reload → show **saved history**.
7. **Export** the chat as PDF.

---

## 📄 License

MIT © The Ark AI Team. Built with ❤️ for learners everywhere.
