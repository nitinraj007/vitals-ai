# VITALS Model Service (Strict Real Inference)

This service exposes model inference endpoints expected by the Node backend.

## Current status

- Scaffold implemented
- No mock/demo scoring is returned
- `/infer/full` returns `503` until trained models are integrated

## Why this behavior

The product is configured for **real inference only**. If trained voice/vision/fusion models are not available, analysis is blocked instead of returning fake scores.

## Run

1. Create a Python environment.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Start service:
   - `uvicorn app:app --host 127.0.0.1 --port 8090 --reload`

## Expected integration contract

`POST /infer/full` should return JSON:

```json
{
  "source": "model-service",
  "modalities": {
    "voice": { "score": 0, "confidence": 0, "markers": [] },
    "vision": { "score": 0, "confidence": 0, "markers": [] },
    "symptom": { "score": 0, "confidence": 0, "markers": [] },
    "behavior": { "score": 0, "confidence": 0, "markers": [] }
  },
  "fusion": { "combinedScore": 0, "riskLevel": "low", "confidence": 0 },
  "categories": [
    {
      "name": "neurological",
      "label": "Neurological",
      "score": 0,
      "confidence": 0,
      "riskLevel": "low",
      "screeningFlag": "monitor",
      "evidence": [{ "source": "voice", "marker": "speech-rhythm", "contribution": 0 }]
    }
  ]
}
```
