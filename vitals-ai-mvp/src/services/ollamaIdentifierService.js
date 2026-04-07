const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function riskLevel(score) {
  if (score < 35) {
    return "low";
  }
  if (score < 65) {
    return "moderate";
  }
  return "high";
}

function signalStats(buffer) {
  if (!buffer || !buffer.length) {
    return { mean: 0, variance: 0, entropy: 0 };
  }

  const stride = Math.max(1, Math.floor(buffer.length / 4096));
  const samples = [];
  for (let i = 0; i < buffer.length; i += stride) {
    samples.push(buffer[i]);
  }

  const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
  const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / samples.length;

  const hist = new Array(16).fill(0);
  samples.forEach((x) => {
    hist[Math.floor(x / 16)] += 1;
  });
  const entropy = hist.reduce((sum, count) => {
    if (!count) {
      return sum;
    }
    const p = count / samples.length;
    return sum - p * Math.log2(p);
  }, 0);

  return {
    mean: Number(mean.toFixed(2)),
    variance: Number(variance.toFixed(2)),
    entropy: Number(entropy.toFixed(3)),
  };
}

function normalizeCategories(categories) {
  return (Array.isArray(categories) ? categories : []).slice(0, 7).map((item) => {
    const score = clamp(item?.score);
    return {
      name: String(item?.name || "generalWellness"),
      label: String(item?.label || item?.name || "General Wellness"),
      score,
      confidence: clamp(item?.confidence),
      riskLevel: String(item?.riskLevel || riskLevel(score)),
      screeningFlag: String(item?.screeningFlag || (score >= 70 ? "priority" : score >= 52 ? "attention" : "monitor")),
      evidence: Array.isArray(item?.evidence)
        ? item.evidence.slice(0, 3).map((ev) => ({
            source: String(ev?.source || "unknown"),
            marker: String(ev?.marker || "signal"),
            contribution: clamp(ev?.contribution),
          }))
        : [],
    };
  });
}

function toCategoryMap(categories) {
  return categories.reduce((acc, item) => {
    acc[item.name] = item.score;
    return acc;
  }, {});
}

function parseOllamaJson(responseText) {
  const raw = String(responseText || "").trim();
  try {
    return JSON.parse(raw);
  } catch (_error) {
    const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenced && fenced[1]) {
      return JSON.parse(fenced[1]);
    }

    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = raw.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sliced);
    }

    throw new Error("Ollama response was not valid JSON");
  }
}

async function inferWithOllamaIdentifier({ voiceFile, visionFile, symptoms, behavior, voiceText }) {
  const voiceSignals = signalStats(voiceFile.buffer);
  const visionSignals = visionFile ? signalStats(visionFile.buffer) : { mean: 0, variance: 0, entropy: 0 };

  const prompt = `You are a preventive health identifier.\nUse these signals to estimate risk scores for screening only.\nDo not diagnose disease.\n\nInputs:\n- Voice transcript hint: ${String(voiceText || "none")}\n- Voice media: size=${voiceFile.size}, mime=${voiceFile.mimetype}, stats=${JSON.stringify(voiceSignals)}\n- Vision media: size=${visionFile ? visionFile.size : 0}, mime=${visionFile ? visionFile.mimetype : "missing"}, stats=${JSON.stringify(visionSignals)}\n- Symptoms: ${JSON.stringify(symptoms)}\n- Behavior: ${JSON.stringify(behavior)}\n\nReturn strict JSON with keys: modalities, fusion, categories.\nmodalities must include voice, vision, symptom, behavior with score/confidence/markers.\ncategories must include exactly these names: neurological, cardiovascular, metabolic, mentalHealth, respiratory, sleepRecovery, generalWellness.\n`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama identifier request failed with status ${response.status}`);
  }

  const data = await response.json();
  const parsed = parseOllamaJson(data.response);

  if (!parsed.modalities || !parsed.fusion || !Array.isArray(parsed.categories)) {
    throw new Error("Ollama identifier payload missing required keys");
  }

  const modalities = {
    voice: {
      score: clamp(parsed.modalities.voice?.score),
      confidence: clamp(parsed.modalities.voice?.confidence),
      markers: Array.isArray(parsed.modalities.voice?.markers)
        ? parsed.modalities.voice.markers.slice(0, 4).map(String)
        : ["voice-pattern"],
    },
    vision: {
      score: clamp(parsed.modalities.vision?.score),
      confidence: clamp(parsed.modalities.vision?.confidence),
      markers: Array.isArray(parsed.modalities.vision?.markers)
        ? parsed.modalities.vision.markers.slice(0, 4).map(String)
        : [visionFile ? "visual-pattern" : "vision-missing"],
    },
    symptom: {
      score: clamp(parsed.modalities.symptom?.score),
      confidence: clamp(parsed.modalities.symptom?.confidence),
      markers: Array.isArray(parsed.modalities.symptom?.markers)
        ? parsed.modalities.symptom.markers.slice(0, 4).map(String)
        : ["symptom-pattern"],
    },
    behavior: {
      score: clamp(parsed.modalities.behavior?.score),
      confidence: clamp(parsed.modalities.behavior?.confidence),
      markers: Array.isArray(parsed.modalities.behavior?.markers)
        ? parsed.modalities.behavior.markers.slice(0, 4).map(String)
        : ["behavior-pattern"],
    },
  };

  const categories = normalizeCategories(parsed.categories);
  const fusion = {
    combinedScore: clamp(parsed.fusion.combinedScore),
    riskLevel: String(parsed.fusion.riskLevel || riskLevel(parsed.fusion.combinedScore)),
    confidence: clamp(parsed.fusion.confidence),
  };

  return {
    modalities,
    fusion,
    categories,
    categoryMap: toCategoryMap(categories),
    source: "ollama-identifier",
  };
}

module.exports = {
  inferWithOllamaIdentifier,
};
