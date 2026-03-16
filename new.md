# Project Overview
Voice-first AI tutor web app for rural Indian children who cannot read or type. React + Vite frontend.

# Core Tech Stack
- React + Vite (frontend)
- Gemini Live API over WebSocket (real-time audio + vision)
- Google GenAI SDK (@google/genai)
- Firestore (user memory)
- Cloud Run (hosting)
- Vertex AI Search (RAG over NCERT PDFs)
- Google Cloud Storage (NCERT PDFs)

# Avatar State Machine
IDLE → LISTENING → SPEAKING → SEEING → SPEAKING → IDLE

- IDLE     → mouth closed, camera hidden
- SPEAKING → mouth toggles open/closed every 200ms
- SEEING   → eyes look down, camera appears at bottom

# Key Product Rule
Camera activates when AI decides to see — never from a user button.

# Target Device
Low-end Android phone. Portrait. Touch. Low bandwidth.

# Environment Variables
- `VITE_GEMINI_API_KEY`
