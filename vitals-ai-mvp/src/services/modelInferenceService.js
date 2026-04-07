const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || "http://127.0.0.1:8090";
const MODEL_TIMEOUT_MS = Number(process.env.MODEL_TIMEOUT_MS || 120000);

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function toRiskLevel(score) {
  if (score < 35) {
    return "low";
  }
  if (score < 65) {
    return "moderate";
  }
  return "high";
}

function toCategoryMap(categories) {
  return categories.reduce((acc, category) => {
    acc[category.name] = category.score;
    return acc;
  }, {});
}

function normalizeModalities(raw) {
  const fallback = { score: 0, confidence: 0, markers: ["missing"] };
  return {
    voice: {
      score: clamp(raw?.voice?.score),
      confidence: clamp(raw?.voice?.confidence),
      markers: Array.isArray(raw?.voice?.markers) ? raw.voice.markers.map(String) : fallback.markers,
    },
    vision: {
      score: clamp(raw?.vision?.score),
      confidence: clamp(raw?.vision?.confidence),
      markers: Array.isArray(raw?.vision?.markers) ? raw.vision.markers.map(String) : fallback.markers,
    },
    symptom: {
      score: clamp(raw?.symptom?.score),
      confidence: clamp(raw?.symptom?.confidence),
      markers: Array.isArray(raw?.symptom?.markers) ? raw.symptom.markers.map(String) : fallback.markers,
    },
    behavior: {
      score: clamp(raw?.behavior?.score),
      confidence: clamp(raw?.behavior?.confidence),
      markers: Array.isArray(raw?.behavior?.markers) ? raw.behavior.markers.map(String) : fallback.markers,
    },
  };
}

function normalizeCategories(rawCategories) {
  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  return categories.map((category) => {
    const score = clamp(category?.score);
    return {
      name: String(category?.name || "unknown"),
      label: String(category?.label || category?.name || "Unknown"),
      score,
      confidence: clamp(category?.confidence),
      riskLevel: String(category?.riskLevel || toRiskLevel(score)),
      screeningFlag: String(category?.screeningFlag || "monitor"),
      evidence: Array.isArray(category?.evidence)
        ? category.evidence.slice(0, 4).map((item) => ({
            source: String(item?.source || "unknown"),
            marker: String(item?.marker || "signal"),
            contribution: clamp(item?.contribution),
          }))
        : [],
    };
  });
}

function assertInferencePayload(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Model service returned an empty payload");
  }
  if (!data.modalities || !data.fusion || !Array.isArray(data.categories)) {
    throw new Error("Model service payload missing modalities, fusion, or categories");
  }
}

async function inferFullCheck({ voiceFile, visionFile, symptoms, behavior, voiceText }) {
  const payload = {
    voice: {
      mimeType: voiceFile.mimetype,
      sizeBytes: voiceFile.size,
      dataBase64: voiceFile.buffer.toString("base64"),
      transcriptHint: String(voiceText || ""),
    },
    vision: {
      mimeType: visionFile.mimetype,
      sizeBytes: visionFile.size,
      dataBase64: visionFile.buffer.toString("base64"),
    },
    symptoms,
    behavior,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${MODEL_SERVICE_URL}/infer/full`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = data?.error || data?.detail || data?.message || `HTTP ${response.status}`;
    throw new Error(`Model inference failed: ${reason}`);
  }

  assertInferencePayload(data);

  const modalities = normalizeModalities(data.modalities);
  const categories = normalizeCategories(data.categories);
  const fusion = {
    combinedScore: clamp(data.fusion.combinedScore),
    riskLevel: String(data.fusion.riskLevel || toRiskLevel(data.fusion.combinedScore)),
    confidence: clamp(data.fusion.confidence),
  };

  return {
    modalities,
    fusion,
    categories,
    categoryMap: toCategoryMap(categories),
    source: String(data.source || "model-service"),
  };
}

module.exports = {
  inferFullCheck,
};
