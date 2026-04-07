# VITALS.AI MVP 🚀

VITALS.AI is a multi-modal early risk screening MVP that combines voice, optional vision, symptom intake, and behavior signals into a single risk report with category breakdowns and AI-generated guidance.

## ✨ Core Capabilities

- 🎙️ Browser voice recording analysis
- 📹 Optional browser vision input
- 🧠 Structured symptom + behavior intake validation
- 📊 Fused risk scoring with confidence
- 🧾 7-category evidence-based screening view
- 🤖 AI explanation via Ollama with robust local fallback
- 🕓 Authenticated user history tracking
- 🔐 JWT-based signup/login flow

## 🧱 System Architecture

This app is intentionally simple to run and demo:

- Backend: Node.js + Express
- Frontend: Vanilla HTML/CSS/JS served from the same backend
- Storage: local JSON database at `data/db.json`
- Auth: `jsonwebtoken` + `bcryptjs`
- Inference orchestration: `src/services/hybridInferenceService.js`

### Request Lifecycle (High Level)

1. User logs in and receives JWT
2. User uploads voice (required), vision (optional), and intake payload
3. Backend validates input ranges and required fields
4. Inference pipeline runs through layered strategy
5. Explanation engine generates user-friendly report text
6. Report is saved and returned for dashboard display

## 🧠 Inference Pipeline (Production-Style Fallbacks)

The backend uses a 3-layer strategy for resilience:

1. 🧪 Trained model layer (`MODEL_SERVICE_URL/infer/full`) - primary
2. 🤖 Ollama identifier layer - fallback if trained model fails
3. 🛟 Heuristic scoring layer - fallback if both layers fail

Every result includes:

- `inferenceLayer`: which layer produced final output
- `inferenceSource`: source name for observability
- `inferenceWarnings`: upstream layer failures (if any)

This design ensures the app keeps returning structured reports even when optional services are down.

## 📁 Project Structure

```text
vitals-ai-mvp/
   public/                 # Frontend files
   src/
      server.js             # Main backend + routes
      auth.js               # JWT middleware
      services/
         hybridInferenceService.js
         modelInferenceService.js
         ollamaIdentifierService.js
         ollamaService.js
         scoringService.js
      utils/
         db.js               # JSON DB read/write
   data/
      db.json               # Runtime storage
   model-service/          # Optional Python model service
```

## ✅ Prerequisites

- Node.js 18+
- npm
- Optional: Ollama installed and running
- Optional: Python model service (see `model-service/README.md`)

## ⚙️ Environment Setup

### 1. Create local env file

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 2. Configure `.env`

Use a strong secret for JWT in your local file.

### Environment Variable Reference

| Variable | Purpose | Example |
|---|---|---|
| `PORT` | Backend port | `8080` |
| `JWT_SECRET` | JWT sign/verify secret | long random string |
| `OLLAMA_BASE_URL` | Ollama base URL | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Ollama model name | `mistral` |
| `USE_OLLAMA` | Enable/disable explanation via Ollama | `true` |
| `MODEL_SERVICE_URL` | External model service URL | `http://127.0.0.1:8090` |
| `MODEL_TIMEOUT_MS` | Model request timeout | `120000` |
| `REQUIRE_VISION` | Force video input in checks | `false` |

## 🛠️ Run Locally

```bash
npm install
npm start
```

App URL:

```text
http://localhost:8080
```

Development watch mode:

```bash
npm run dev
```

## 🤖 Optional Services

### Ollama (Recommended for richer AI explanation)

```bash
ollama serve
ollama pull mistral
```

If Ollama is down, a local structured explanation is still returned.

### Python Model Service (Primary inference layer)

From `model-service` directory:

```bash
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8090 --reload
```

If this service fails, fallback layers continue automatically.

## 👤 User Workflow

1. Sign up or log in
2. Record voice (required)
3. Record vision (optional unless `REQUIRE_VISION=true`)
4. Fill symptom and behavior fields
5. Click Analyze
6. Review report, category scores, confidence, and explanation
7. View history and print latest report

## 🔌 API Reference

### Public

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`

### Auth Required (Bearer token)

- `POST /api/checks/full` (multipart form)
- `GET /api/checks/history`
- `GET /api/checks/latest`

### Minimal `POST /api/checks/full` Form Fields

- `voice`: file (required)
- `vision`: file (optional unless strict mode)
- `symptoms`: JSON string
- `behavior`: JSON string
- `voiceText`: string (optional)

### Successful Response Includes

- `modalities`
- `fusion`
- `categories`
- `categoryMap`
- `inferenceLayer`
- `inferenceSource`
- `inferenceWarnings`
- `assistant`

## 🧪 Data Validation Rules

The backend validates intake ranges before inference:

- `symptoms.energyLevel`: 1..10
- `symptoms.sleepQuality`: 1..10
- `symptoms.stressLevel`: 1..10
- `symptoms.moodLevel`: 1..10
- `symptoms.fatigueType`: `physical` or `mental` or `both`
- `behavior.sleepHours`: 0..14
- `behavior.stressLevel`: 1..10
- `behavior.exerciseMinutes`: 0..180
- `behavior.moodLevel`: 1..10

## 🧯 Troubleshooting Guide

- `401 Missing auth token`
   - Login first and send `Authorization: Bearer <token>`.
- `Invalid or expired token`
   - Re-login to refresh JWT.
- `Voice recording is required`
   - `voice` file is mandatory.
- `Vision recording is required in strict mode`
   - Set `REQUIRE_VISION=false` in `.env` for optional vision.
- Model service errors or timeout
   - Check `MODEL_SERVICE_URL`, service status, and `MODEL_TIMEOUT_MS`.
- Ollama generation failures
   - Ensure `ollama serve` is running and model exists.

## 🔒 Security and Upload Hygiene

- Never commit `.env`.
- Keep `JWT_SECRET` strong and private.
- `data/db.json` is runtime data; sanitize before sharing.
- Use `.env.example` for public configuration templates.

## ⚕️ Medical Disclaimer

This project is an early risk screening and educational/demo tool. It is not a diagnosis system and must not replace clinical medical advice.

## 🤝 Contributing

If you are extending this MVP:

1. Keep API response shape backward compatible
2. Preserve inference fallback behavior
3. Avoid committing runtime secrets or user data
4. Update this README when changing setup or API behavior
