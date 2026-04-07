from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


class MediaPayload(BaseModel):
    mimeType: str
    sizeBytes: int = Field(gt=0)
    dataBase64: str = Field(min_length=16)


class SymptomPayload(BaseModel):
    energyLevel: float = Field(ge=1, le=10)
    sleepQuality: float = Field(ge=1, le=10)
    stressLevel: float = Field(ge=1, le=10)
    moodLevel: float = Field(ge=1, le=10)
    fatigueType: str


class BehaviorPayload(BaseModel):
    sleepHours: float = Field(ge=0, le=14)
    stressLevel: float = Field(ge=1, le=10)
    exerciseMinutes: float = Field(ge=0, le=180)
    moodLevel: float = Field(ge=1, le=10)


class FullInferenceRequest(BaseModel):
    voice: MediaPayload
    vision: MediaPayload
    symptoms: SymptomPayload
    behavior: BehaviorPayload


app = FastAPI(title="Vitals AI Model Service", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "vitals-model-service",
        "ready": False,
        "message": "Inference service scaffold is running. Plug trained voice/vision/fusion models before production use.",
    }


@app.post("/infer/full")
def infer_full(_payload: FullInferenceRequest) -> dict:
    raise HTTPException(
        status_code=503,
        detail="No trained model pipeline configured yet. Real inference is required and mock scoring is disabled.",
    )
