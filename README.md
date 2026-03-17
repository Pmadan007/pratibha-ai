# 🎓 Pratibha AI

**A voice-first AI tutor for rural Indian children who cannot read or type.**

Pratibha speaks to children in their own language — Hindi, English, Tamil, Telugu, Marathi, Bengali, Kannada, or Gujarati — using real-time audio powered by Gemini Live 2.5 Flash. She remembers each child's name, class, and weak topics across sessions. She can look at physical objects through the camera when a child asks "yeh kya hai?" and generate educational illustrations on the fly.

Built for the **Google AI Hackathon 2026**.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎙 Voice-first | No reading or typing required — fully conversational |
| 🌐 8 Indian languages | Hindi, English, Tamil, Telugu, Marathi, Bengali, Kannada, Gujarati |
| 🧑 Animated avatar | 4-state face: idle → listening → speaking → seeing |
| 📷 AI-controlled camera | Opens only when child says "dekho" / "see this" — never a manual button |
| 🎨 Live illustrations | Generates educational images mid-conversation via Gemini 2.5 Flash Image |
| 🧠 Persistent memory | Remembers name, class, and weak topics via Firestore |
| 📱 Low-end device ready | Optimised for portrait Android phones on low bandwidth |
| ☁ Cloud Run hosted | Node.js WebSocket proxy deployed on Google Cloud Run |

---

## 🏗 Architecture

```
┌─────────────────────┐        WebSocket         ┌──────────────────────────┐
│   React / Vite      │ ◄──── PCM audio ────────► │  Node.js Proxy (Cloud    │
│   Frontend          │       video frames         │  Run / localhost:3001)   │
│                     │       tool calls           │                          │
│  • Language picker  │                            │  • /live  → Vertex AI    │
│  • Animated avatar  │ ◄──── audio response ───── │  • /api/generate-image   │
│  • Camera preview   │       illustrations        │  • /api/profile          │
│  • Mic button       │                            └──────────┬───────────────┘
└─────────────────────┘                                       │
                                                   ┌──────────▼───────────────┐
                                                   │      Google Cloud        │
                                                   │                          │
                                                   │  ⚡ Gemini Live 2.5 Flash │
                                                   │  🎨 Gemini 2.5 Flash Img  │
                                                   │  🗄  Firestore            │
                                                   └──────────────────────────┘
```

Full interactive architecture diagram: [`docs/architecture.html`](docs/architecture.html)

---

## 🚀 Local Spin-Up

### Prerequisites

- Node.js 18+
- A Google Cloud project with the following APIs enabled:
  - Vertex AI API
  - Firestore API
- A service account with `Vertex AI User` + `Cloud Datastore User` roles
- Service account key downloaded as `service-account.json`

### 1. Clone & install

```bash
git clone https://github.com/your-org/ai-tutor.git
cd ai-tutor
npm install
```

### 2. Add your service account key

Place your Google Cloud service account JSON at the project root:

```bash
cp /path/to/your-key.json ./service-account.json
```

> The key is used by the Node.js proxy to authenticate with Vertex AI and Firestore. It is gitignored and never sent to the browser.

### 3. Start the backend proxy

```bash
node server.js
# → [proxy] listening on :3001
```

### 4. Start the frontend dev server

In a second terminal:

```bash
npm run dev
# → Local: http://localhost:5173
```

Vite proxies `/live` (WebSocket) and `/api` (HTTP) to `localhost:3001` automatically.

### 5. Open in browser

```
http://localhost:5173
```

Pick a language, press 🎤, and start talking.

---

## 🌐 Production Deployment (Cloud Run)

### Build the frontend

```bash
npm run build
# outputs to dist/
```

### Deploy the server

The `server.js` serves the built `dist/` folder as static files and handles all API routes. Deploy it to Cloud Run:

```bash
gcloud run deploy pratibha-ai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets=SERVICE_ACCOUNT_JSON=service-account-json:latest
```

> Alternatively, mount `service-account.json` as a Cloud Run secret volume at `/app/service-account.json`.

---

## 📁 Project Structure

```
ai-tutor/
├── server.js                  # Node.js WebSocket proxy + REST API
├── vite.config.js             # Vite config with proxy rules
├── public/
│   ├── avatars/               # WebP avatar frames (idle, slight, open, lookDown)
│   ├── bg.webp                # Background image
│   └── pcm-processor.js      # AudioWorklet for 16kHz PCM capture
├── src/
│   ├── App.jsx                # Root component, session + state orchestration
│   ├── components/
│   │   ├── Avatar.jsx         # Animated face (4-state)
│   │   ├── CameraPreview.jsx  # Live camera feed overlay
│   │   ├── LanguageSelector.jsx
│   │   └── StatusBar.jsx
│   ├── hooks/
│   │   ├── useGeminiSession.js  # WebSocket session, tool call handling
│   │   ├── useAudioCapture.js   # Mic → PCM AudioWorklet → 16kHz chunks
│   │   ├── useAudioPlayer.js    # PCM queue → Web Audio API playback
│   │   ├── useCamera.js         # getUserMedia → canvas JPEG frames
│   │   └── useAvatarState.js    # IDLE / LISTENING / SPEAKING / SEEING FSM
│   ├── lib/
│   │   ├── geminiClient.js      # WebSocket setup message + session object
│   │   ├── firestore.js         # Profile read/write via proxy REST API
│   │   └── imageGeneration.js   # POST /api/generate-image
│   └── constants/
│       └── avatarStates.js
└── docs/
    └── architecture.html      # Interactive architecture diagram
```

---

## 🤖 AI Behaviour

### Avatar state machine

```
IDLE → (mic pressed) → LISTENING → (AI responds) → SPEAKING → IDLE
                                                  ↘ SEEING (camera open)
```

### Tool calls Pratibha can make

| Tool | When |
|---|---|
| `open_camera` | Child says "yeh kya hai", "dekho", "see this", etc. |
| `close_camera` | Child moves to a completely new topic |
| `save_profile` | After child shares their name and class |
| `save_weak_topics` | When child repeatedly struggles with a topic |
| `show_image` | At the start of any concept explanation |

### Memory

Student profiles are stored in Firestore under `students/{userId}` with fields: `name`, `class`, `weak_topics`. On next session, the profile is loaded and injected into the system prompt so Pratibha greets the child by name and tailors explanations to their class level.

---

## 🔑 Environment

No `.env` file is needed for local dev — the service account key file handles all auth.

For Vite-only deployments (without the Node.js proxy), set:

```
VITE_GEMINI_API_KEY=your_key_here
```

---

## 📜 License

MIT
