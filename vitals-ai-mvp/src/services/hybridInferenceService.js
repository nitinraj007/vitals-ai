const { inferFullCheck } = require("./modelInferenceService");
const { inferWithOllamaIdentifier } = require("./ollamaIdentifierService");
const {
  scoreVoice,
  scoreVision,
  scoreSymptoms,
  scoreBehavior,
  fuseScores,
} = require("./scoringService");

async function inferWithHeuristicFallback({ voiceFile, visionFile, symptoms, behavior, voiceText }) {
  const voice = scoreVoice({ sizeBytes: voiceFile.size, userText: voiceText });
  const vision = visionFile
    ? scoreVision({ sizeBytes: visionFile.size })
    : { score: 45, confidence: 30, markers: ["vision-missing"] };
  const symptom = scoreSymptoms(symptoms);
  const behaviorScore = scoreBehavior(behavior);

  const modalities = {
    voice,
    vision,
    symptom,
    behavior: behaviorScore,
  };

  const fusion = fuseScores(modalities);
  return {
    modalities,
    fusion: {
      combinedScore: fusion.combinedScore,
      riskLevel: fusion.riskLevel,
      confidence: fusion.confidence,
    },
    categories: fusion.categories,
    categoryMap: fusion.categoryMap,
    source: "heuristic-fallback",
  };
}

async function inferWithLayers(input) {
  const errors = [];

  try {
    const trained = await inferFullCheck(input);
    return {
      ...trained,
      layer: "trained-model",
      warnings: errors,
    };
  } catch (error) {
    errors.push({ layer: "trained-model", reason: error.message });
  }

  try {
    const ollama = await inferWithOllamaIdentifier(input);
    return {
      ...ollama,
      layer: "ollama-identifier",
      warnings: errors,
    };
  } catch (error) {
    errors.push({ layer: "ollama-identifier", reason: error.message });
  }

  const fallback = await inferWithHeuristicFallback(input);
  return {
    ...fallback,
    layer: "heuristic-fallback",
    warnings: errors,
  };
}

module.exports = {
  inferWithLayers,
};
