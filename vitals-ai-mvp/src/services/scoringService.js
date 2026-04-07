function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreVoice({ sizeBytes, userText }) {
  const lengthFactor = Math.min(sizeBytes / 18000, 1) * 24;
  const stressWords = /(tired|stress|anxiety|fatigue|weak|pain|sleepy|burnout)/i.test(userText || "") ? 14 : 0;
  const calmWords = /(good|fresh|calm|energetic|better|stable)/i.test(userText || "") ? 8 : 0;
  const base = 42 + lengthFactor + stressWords - calmWords;
  return {
    score: clamp(Math.round(base)),
    confidence: clamp(Math.round(65 + Math.min(sizeBytes / 9000, 28))),
    markers: ["voice-energy", "breath-stability", "speech-rhythm"],
  };
}

function scoreVision({ sizeBytes }) {
  const qualityFactor = Math.min(sizeBytes / 25000, 1) * 22;
  const base = 38 + qualityFactor;
  return {
    score: clamp(Math.round(base)),
    confidence: clamp(Math.round(60 + Math.min(sizeBytes / 10000, 30))),
    markers: ["facial-fatigue", "skin-tone-variation", "micro-expression"],
  };
}

function scoreSymptoms(payload) {
  const energy = Number(payload.energyLevel || 5);
  const sleep = Number(payload.sleepQuality || 5);
  const stress = Number(payload.stressLevel || 5);
  const mood = Number(payload.moodLevel || 5);
  const fatigue = payload.fatigueType === "both" ? 2 : payload.fatigueType ? 1 : 0;

  const riskRaw = 100 - energy * 8 - sleep * 6 + stress * 7 + (6 - mood) * 6 + fatigue * 8;
  const score = clamp(Math.round(riskRaw));

  return {
    score,
    confidence: clamp(Math.round(74 + fatigue * 6)),
    markers: ["energy-drop", "stress-load", "recovery-pattern"],
  };
}

function scoreBehavior(payload) {
  const sleepHours = Number(payload.sleepHours || 7);
  const stress = Number(payload.stressLevel || 5);
  const exerciseMinutes = Number(payload.exerciseMinutes || 20);
  const mood = Number(payload.moodLevel || 5);

  let risk = 50;
  risk += sleepHours < 6 ? 18 : sleepHours > 9 ? 6 : 0;
  risk += stress * 5;
  risk -= Math.min(exerciseMinutes, 60) * 0.5;
  risk += (6 - mood) * 4;

  return {
    score: clamp(Math.round(risk)),
    confidence: clamp(Math.round(70 + Math.min(exerciseMinutes / 6, 10))),
    markers: ["sleep-pattern", "stress-trend", "activity-balance"],
  };
}

function getRiskLevel(score) {
  if (score < 35) {
    return "low";
  }
  if (score < 65) {
    return "moderate";
  }
  return "high";
}

function getScreeningFlag(score, confidence) {
  if (score >= 72 && confidence >= 65) {
    return "priority";
  }
  if (score >= 52) {
    return "attention";
  }
  return "monitor";
}

const CATEGORY_CONFIG = [
  {
    name: "neurological",
    label: "Neurological",
    weights: { voice: 0.42, symptom: 0.33, behavior: 0.2, vision: 0.05 },
  },
  {
    name: "cardiovascular",
    label: "Cardiovascular",
    weights: { behavior: 0.38, symptom: 0.3, voice: 0.18, vision: 0.14 },
  },
  {
    name: "metabolic",
    label: "Metabolic",
    weights: { behavior: 0.4, symptom: 0.34, vision: 0.16, voice: 0.1 },
  },
  {
    name: "mentalHealth",
    label: "Mental Health",
    weights: { symptom: 0.38, voice: 0.32, behavior: 0.24, vision: 0.06 },
  },
  {
    name: "respiratory",
    label: "Respiratory",
    weights: { voice: 0.38, vision: 0.32, symptom: 0.2, behavior: 0.1 },
  },
  {
    name: "sleepRecovery",
    label: "Sleep & Recovery",
    weights: { behavior: 0.43, symptom: 0.33, voice: 0.16, vision: 0.08 },
  },
  {
    name: "generalWellness",
    label: "General Wellness",
    weights: { voice: 0.25, vision: 0.25, symptom: 0.25, behavior: 0.25 },
  },
];

function buildCategoryInsights(modalities, combinedScore) {
  const modalityEntries = Object.entries(modalities);
  return CATEGORY_CONFIG.map((config) => {
    const weightedScore = modalityEntries.reduce((sum, [modality, details]) => {
      const weight = config.weights[modality] || 0;
      return sum + details.score * weight;
    }, 0);

    const blendedScore = clamp(Math.round(weightedScore * 0.82 + combinedScore * 0.18));
    const confidence = clamp(
      Math.round(
        modalityEntries.reduce((sum, [modality, details]) => {
          const weight = config.weights[modality] || 0;
          return sum + details.confidence * weight;
        }, 0)
      )
    );

    const evidence = modalityEntries
      .map(([modality, details]) => {
        const contribution = Math.round((config.weights[modality] || 0) * details.score);
        return {
          source: modality,
          marker: details.markers[0],
          contribution,
        };
      })
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);

    return {
      name: config.name,
      label: config.label,
      score: blendedScore,
      confidence,
      riskLevel: getRiskLevel(blendedScore),
      screeningFlag: getScreeningFlag(blendedScore, confidence),
      evidence,
    };
  });
}

function categoryArrayToMap(categories) {
  return categories.reduce((acc, category) => {
    acc[category.name] = category.score;
    return acc;
  }, {});
}

function getOverallConfidence(modalities) {
  const entries = Object.values(modalities);
  const confidenceAverage = average(entries.map((entry) => entry.confidence));
  const scoreSpread = Math.max(...entries.map((entry) => entry.score)) - Math.min(...entries.map((entry) => entry.score));
  return clamp(Math.round(confidenceAverage - scoreSpread * 0.2), 45, 95);
}

function fuseScores(modalities) {
  const weighted =
    modalities.voice.score * 0.32 +
    modalities.vision.score * 0.2 +
    modalities.symptom.score * 0.28 +
    modalities.behavior.score * 0.2;

  const combinedScore = clamp(Math.round(weighted));
  const riskLevel = getRiskLevel(combinedScore);
  const confidence = getOverallConfidence(modalities);
  const categories = buildCategoryInsights(modalities, combinedScore);

  return {
    combinedScore,
    riskLevel,
    confidence,
    categories,
    categoryMap: categoryArrayToMap(categories),
  };
}

module.exports = {
  scoreVoice,
  scoreVision,
  scoreSymptoms,
  scoreBehavior,
  fuseScores,
};
