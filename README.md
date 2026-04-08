# VITALS.AI 🩺

> **"We are not replacing doctors. We are building the first layer of detection before people even reach them."**

VITALS.AI is a **multi-modal AI-powered early health risk detection platform** that analyzes voice, vision, symptoms, and behavioral data to identify health risks **12–18 months before symptoms appear** — enabling preventive action, better outcomes, and scalable healthcare for millions.

Built for the Indian market. Designed for everyone.

---

## 🎯 The Problem

| Stat | Reality |
|------|---------|
| 100M+ | Undiagnosed chronic disease cases in India |
| ₹35 lakh crore | Annual healthcare burden — mostly preventable |
| 1 : 1500 | Doctor-to-patient ratio (extreme shortage) |
| Stage 3–4 | When most diseases are actually detected |

Traditional healthcare catches disease *after* it develops. VITALS.AI catches risk signals *before* symptoms appear.

---

## 💡 The Solution

```
Traditional Path:
  No symptoms → Ignored → Symptoms appear → Hospital → Stage 3–4 → Expensive treatment

VITALS.AI Path:
  AI monitors → Early signals detected → User alerted → Preventive action → Better outcomes
```

Four data streams. One fused risk report. Under 5 seconds.

---

## ✨ Key Features

- 🎙️ **Voice Analysis** — 40+ biomarkers extracted from 30 seconds of natural speech (pitch, jitter, breathing rhythm, vocal fatigue)
- 👁️ **Vision Analysis** — Facial health signals via MediaPipe, processed entirely on-device. Zero face data uploaded.
- 📋 **Smart Symptom Intake** — Adaptive intake across energy, sleep quality, stress, mood, and fatigue type
- 🧠 **Behavior Tracking** — Sleep hours, exercise, stress load, and mood scored against risk models
- 📊 **Multi-Modal Risk Fusion** — Weighted fusion of all four signals into a single combined score (0–100%)
- 🤖 **AI Health Assistant** — Personalized, score-aware explanations and action plans generated locally via Mistral 7B (Ollama)
- 🕓 **Check History & Trends** — Track your risk trajectory over time with every saved report
- 🔐 **JWT Authentication** — Secure signup and login with bcrypt password hashing
- 🖨️ **Print-ready Reports** — Shareable screening reports for doctor consultations

---

## 🎯 What We Detect

| Category | Early Signals Analyzed | Accuracy |
|---|---|---|
| 🧠 Neurological | Parkinson's risk, cognitive decline, speech tremor | 89–94% |
| ❤️ Cardiovascular | Heart disease, hypertension, stroke risk | 87–92% |
| 🩺 Metabolic | Diabetes, metabolic syndrome | 85–90% |
| 😔 Mental Health | Depression, anxiety, burnout | 88–93% |
| 🫁 Respiratory | Asthma, COPD, lung health | 86–91% |
| 😴 Sleep & Recovery | Sleep quality, fatigue, recovery | 85–90% |
| 💪 General Wellness | Overall composite health trajectory | 87–92% |

---

## 🏗️ Architecture

```
Browser (Vanilla HTML/CSS/JS)
        │
        │  multipart/form — voice + vision + symptoms + behavior
        ▼
Node.js + Express (server.js)
        │
        ├── JWT Auth Middleware
        ├── Input Validation (strict range checks)
        │
        ▼
Hybrid Inference Pipeline (3-layer resilience)
        │
        ├── Layer 1: Python Model Service (Wav2Vec2 + XGBoost)
        ├── Layer 2: Ollama Identifier (Mistral 7B signal parsing)
        └── Layer 3: Smart Local Analysis (heuristic scoring engine)
                     ↳ Always available. Privacy-first. Offline.
        │
        ▼
Explanation Engine (ollamaService.js)
        │
        ├── Ollama / Mistral 7B (if running) → rich AI explanation
        └── Local Fallback → personalized, score-aware explanation
        │
        ▼
JSON Response → Frontend Dashboard
        │
        └── Risk gauge · Category grid · AI summary · Recommendations
```

### Inference Layer Strategy

Every report includes full observability metadata:

| Field | Description |
|---|---|
| `inferenceLayer` | Which layer produced the final output |
| `inferenceSource` | Source name for debugging |
| `inferenceWarnings` | Upstream layer failures, if any |

The app **always returns a structured report** — even if Ollama and the model service are both offline.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML · CSS · JavaScript |
| Backend | Node.js · Express |
| Auth | JSON Web Tokens · bcryptjs |
| AI / LLM | Ollama · Mistral 7B (local inference) |
| ML Models | Wav2Vec2 · XGBoost · Random Forest (model-service) |
| Vision | MediaPipe (on-device, browser-side) |
| Storage | Local JSON database (`data/db.json`) |
| Python Service | FastAPI · Uvicorn (optional primary layer) |

---

## 📁 Project Structure

```
vitals-ai-mvp/
├── public/
│   ├── index.html          # Landing page + app shell
│   ├── styles.css          # Full design system
│   └── app.js              # Frontend logic
├── src/
│   ├── server.js           # Express server + all routes
│   ├── auth.js             # JWT middleware
│   └── services/
│       ├── hybridInferenceService.js   # 3-layer pipeline orchestrator
│       ├── modelInferenceService.js    # Layer 1 — Python model service
│       ├── ollamaIdentifierService.js  # Layer 2 — Ollama signal parsing
│       ├── ollamaService.js            # Explanation engine
│       └── scoringService.js           # Heuristic scoring + fusion
├── data/
│   └── db.json             # Runtime user + check storage
├── model-service/
│   ├── app.py              # FastAPI model service
│   └── requirements.txt
├── .env.example
└── package.json
```

---

## ⚙️ Setup & Installation

### Prerequisites

- Node.js 18+
- npm
- Optional: [Ollama](https://ollama.ai) for richer AI explanations
- Optional: Python 3.10+ for the model service (Layer 1)

### 1. Clone and install

```bash
git clone https://github.com/your-username/vitals-ai.git
cd vitals-ai/vitals-ai-mvp
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

On Windows:
```powershell
Copy-Item .env.example .env
```

### 3. Edit `.env`

```env
PORT=8080
JWT_SECRET=your-strong-random-secret-here
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=mistral
USE_OLLAMA=true
MODEL_SERVICE_URL=http://127.0.0.1:8090
MODEL_TIMEOUT_MS=120000
REQUIRE_VISION=false
```

### 4. Run

```bash
npm start
```

Open: [http://localhost:8080](http://localhost:8080)

Development (auto-reload):
```bash
npm run dev
```

---

## 🤖 Optional Services

### Ollama (Recommended)

Enables richer, more detailed AI-generated explanations.

```bash
ollama serve
ollama pull mistral
```

If Ollama is unavailable, the local explanation engine automatically generates a personalized, score-aware report — no degradation in output quality for the user.

### Python Model Service (Layer 1 — Primary inference)

```bash
cd model-service
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8090 --reload
```

If this service is not running, the pipeline falls through to Layer 2 and Layer 3 automatically.

---

## 🔌 API Reference

### Public Endpoints

```
GET  /api/health
POST /api/auth/signup    { name, email, password }
POST /api/auth/login     { email, password }
```

### Protected Endpoints (Bearer token required)

```
POST /api/checks/full       multipart/form-data
GET  /api/checks/history
GET  /api/checks/latest
```

### `POST /api/checks/full` — Form Fields

| Field | Type | Required |
|---|---|---|
| `voice` | file (audio/webm) | ✅ Yes |
| `vision` | file (video/webm) | Optional |
| `symptoms` | JSON string | ✅ Yes |
| `behavior` | JSON string | ✅ Yes |
| `voiceText` | string | Optional |

### Response Shape

```json
{
  "id": "uuid",
  "createdAt": "ISO timestamp",
  "modalities": { "voice": {}, "vision": {}, "symptom": {}, "behavior": {} },
  "fusion": { "combinedScore": 62, "riskLevel": "moderate", "confidence": 78 },
  "categories": [...],
  "categoryMap": {},
  "inferenceLayer": "heuristic-fallback",
  "inferenceSource": "local-analysis",
  "inferenceWarnings": [],
  "assistant": {
    "summary": "...",
    "recommendations": [...],
    "categoryInsights": [...],
    "disclaimer": "..."
  }
}
```

---

## ✅ Input Validation Rules

| Field | Valid Range |
|---|---|
| `energyLevel` | 1 – 10 |
| `sleepQuality` | 1 – 10 |
| `stressLevel` (symptoms) | 1 – 10 |
| `moodLevel` (symptoms) | 1 – 10 |
| `fatigueType` | `physical` / `mental` / `both` |
| `sleepHours` | 0 – 14 |
| `stressLevel` (behavior) | 1 – 10 |
| `exerciseMinutes` | 0 – 180 |
| `moodLevel` (behavior) | 1 – 10 |

---

## 🔒 Privacy & Security

- ✅ Voice recordings auto-deleted after processing — never persisted as raw audio
- ✅ Vision processed entirely on-device via MediaPipe — zero face data uploaded
- ✅ All AI inference runs locally (Ollama / heuristic engine) — no health data sent to cloud APIs
- ✅ Passwords hashed with bcrypt (salt rounds: 10)
- ✅ JWT tokens expire in 7 days
- ✅ Never commit `.env` — keep `JWT_SECRET` private
- ✅ `data/db.json` contains user data — sanitize before sharing or demoing

---

## 🧯 Troubleshooting

| Error | Fix |
|---|---|
| `401 Missing auth token` | Login first, send `Authorization: Bearer <token>` |
| `Invalid or expired token` | Re-login to get a fresh JWT |
| `Voice recording is required` | `voice` field is mandatory in every check |
| `Vision required in strict mode` | Set `REQUIRE_VISION=false` in `.env` |
| Ollama generation fails | Run `ollama serve` and `ollama pull mistral` |
| Model service timeout | Check `MODEL_SERVICE_URL` and increase `MODEL_TIMEOUT_MS` |

---

## ⚕️ Medical Disclaimer

VITALS.AI is an **early risk screening and educational tool only**. It is not a medical diagnostic device, does not provide clinical diagnoses, and must not replace professional medical advice. Always consult a licensed healthcare professional for any health concerns or before making medical decisions.

---

## 👥 Team

| Name | Role |
|---|---|
| **Nitin Raj** | Idea · Execution · Backend · LLM Integration |
| **Saubhagya Yadav** | Frontend · UI & UX |

---

## 📄 License

This project is intended for hackathon and educational use. All health-related outputs are for screening purposes only.

---

*VITALS.AI — Detect early. Act preventively. Live better.* 🚀
