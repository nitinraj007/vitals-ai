const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL || "mistral";

function toDisplayName(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (x) => x.toUpperCase());
}

const CATEGORY_META = {
  neurological:    { icon: "🧠", name: "Neurological",    system: "brain and nervous system" },
  cardiovascular:  { icon: "❤️", name: "Cardiovascular",  system: "heart and circulatory system" },
  metabolic:       { icon: "🩺", name: "Metabolic",       system: "metabolic and endocrine system" },
  mentalHealth:    { icon: "😔", name: "Mental Health",   system: "mental and emotional wellbeing" },
  respiratory:     { icon: "🫁", name: "Respiratory",     system: "lungs and breathing system" },
  sleepRecovery:   { icon: "😴", name: "Sleep & Recovery", system: "sleep quality and recovery" },
  generalWellness: { icon: "💪", name: "General Wellness", system: "overall health trajectory" },
};

function buildSummary(report) {
  const { fusion, modalities, categories } = report;
  const top = [...(categories || [])].sort((a, b) => b.score - a.score).slice(0, 2);
  const topNames = top.map((c) => CATEGORY_META[c.name]?.name || c.label || c.name).join(" and ");

  const voiceScore    = modalities?.voice?.score    || 0;
  const behaviorScore = modalities?.behavior?.score || 0;

  const sleepMention  = behaviorScore > 60
    ? "Lifestyle patterns — particularly sleep consistency and stress load — are contributing significantly to the elevated readings. "
    : "";
  const voiceMention  = voiceScore > 65
    ? "Voice biomarker signals indicate notable fatigue and stress markers in your speech patterns. "
    : voiceScore > 45
    ? "Voice analysis shows mild stress indicators in your speech cadence and breathing patterns. "
    : "Voice biomarkers appear relatively stable. ";

  let levelSentence = "";
  if (fusion.riskLevel === "high") {
    levelSentence = `Your combined screening score of ${fusion.combinedScore}% indicates elevated risk signals across multiple systems — prompt preventive action is strongly recommended. `;
  } else if (fusion.riskLevel === "moderate") {
    levelSentence = `Your combined screening score of ${fusion.combinedScore}% shows moderate risk signals. Early preventive action now can meaningfully improve your trajectory in the next 2–4 weeks. `;
  } else {
    levelSentence = `Your combined screening score of ${fusion.combinedScore}% reflects healthy patterns overall. Maintaining your current lifestyle habits will be key to keeping this score low. `;
  }

  const topFocus = top.length > 0
    ? `The highest screening signals are in ${topNames} — these areas deserve your most immediate focus. `
    : "";

  return (
    levelSentence + voiceMention + sleepMention + topFocus +
    "Remember: this is a preventive early-detection screening, not a clinical diagnosis. Always consult a licensed doctor before making medical decisions."
  );
}

function buildRecommendations(report) {
  const { fusion, modalities } = report;
  const recs = [];
  const behavior = modalities?.behavior;
  const symptom   = modalities?.symptom;

  if (behavior && behavior.score > 55) {
    recs.push("Prioritise a strict 7–8 hour sleep schedule for the next 14 days — irregular sleep is your most modifiable risk factor right now.");
  } else {
    recs.push("Maintain your current sleep rhythm — consistency of 7–8 hours nightly is essential for keeping your recovery score stable.");
  }

  recs.push("Add at least 30 minutes of moderate-intensity movement (walking, cycling, or swimming) 5 days this week to lower your behavioral risk markers.");

  if (symptom && symptom.score > 50) {
    recs.push("Practice one daily stress-reduction session — box breathing (4-4-4-4), progressive muscle relaxation, or a 10-minute nature walk — to reduce your symptom stress load.");
  } else {
    recs.push("Continue managing stress proactively — your current levels are manageable. Track your daily stress on a 1–10 scale to spot patterns early.");
  }

  if (fusion.riskLevel === "high") {
    recs.push("Schedule a general health consultation with a physician within the next 7 days. Bring this VITALS.AI report to your appointment as a starting point.");
  } else if (fusion.riskLevel === "moderate") {
    recs.push("Book a preventive health check within the next 30 days and share this screening report with your doctor as context for the appointment.");
  } else {
    recs.push(`Run your next full VITALS check in 14 days to confirm your trend is holding steady — healthy patterns need regular verification to stay on track.`);
  }

  return recs.slice(0, 4);
}

function buildCategoryInsights(categories, modalities) {
  return (categories || []).map((cat) => {
    const meta = CATEGORY_META[cat.name] || {};
    const topSources = (cat.evidence || []).slice(0, 2).map((e) => e.source).join(" and ") || "combined input signals";

    let reasoning = "";
    if (cat.riskLevel === "high") {
      reasoning = `${meta.name || cat.label} signals are elevated at ${cat.score}%. Input from ${topSources} shows notable stress markers in the ${meta.system || cat.name}. This area should be prioritised — consider discussing with a healthcare provider in the next 7 days.`;
    } else if (cat.riskLevel === "moderate") {
      reasoning = `${meta.name || cat.label} shows moderate screening signals at ${cat.score}%. Patterns from ${topSources} suggest the ${meta.system || cat.name} is under some strain. Targeted lifestyle changes can meaningfully reduce this score within 1–2 weeks.`;
    } else {
      reasoning = `${meta.name || cat.label} signals are within a healthy screening range at ${cat.score}%. Your ${meta.system || cat.name} appears to be functioning well based on current input data. Maintaining your current habits is the priority.`;
    }

    const actions = cat.riskLevel === "high"
      ? [
          `Consult a doctor and specifically mention this ${cat.score}% screening signal for the ${meta.system || cat.name}.`,
          "Eliminate the top 1–2 stressors affecting this system this week. Recheck in 5 days.",
        ]
      : cat.riskLevel === "moderate"
      ? [
          `Add one targeted daily recovery habit for the ${meta.system || cat.name} — sleep consistency, hydration, or breathing exercises.`,
          "Track this category over the next 10 days — a 5%+ improvement indicates your changes are working.",
        ]
      : [
          "Keep your current sleep, exercise, and nutrition habits stable — they are clearly working.",
          "Recheck in 14 days to confirm this positive screening signal is holding.",
        ];

    return {
      name: cat.name,
      label: meta.name || cat.label || toDisplayName(cat.name),
      icon: meta.icon || "",
      reasoning,
      actions,
      nextCheckInDays: cat.screeningFlag === "priority" ? 5 : cat.riskLevel === "moderate" ? 10 : 14,
    };
  });
}

function fallbackExplanation(report) {
  const { categories, modalities, fusion } = report;
  const sortedCats = [...(categories || [])].sort((a, b) => b.score - a.score);

  return {
    summary: buildSummary(report),
    recommendations: buildRecommendations(report),
    categoryInsights: buildCategoryInsights(sortedCats, modalities),
    nextCheckInDays: fusion.riskLevel === "high" ? 5 : fusion.riskLevel === "moderate" ? 10 : 14,
    disclaimer:
      "This report was generated by VITALS.AI's Smart Local Analysis engine using voice biomarkers, symptom intake, and behavioral data. It is a preventive screening aid — not a medical diagnosis. Always consult a licensed healthcare professional before making any medical decisions.",
    source: "local-analysis",
  };
}

async function generateWithOllama(report) {
  const prompt = `You are a preventive health screening assistant.
CRITICAL POLICY:
- Use non-diagnostic language only.
- Never claim a disease is confirmed.
- Use wording like: "signals suggest", "screening indicates", "consider discussing with a doctor".
- Keep recommendations practical and preventive.

Return valid minified JSON with keys:
{
  "summary": string,
  "recommendations": string[4],
  "categoryInsights": [{
    "name": string,
    "label": string,
    "reasoning": string,
    "actions": string[2],
    "nextCheckInDays": number
  }],
  "nextCheckInDays": number,
  "disclaimer": string
}

Use this report JSON exactly as context:
${JSON.stringify(report)}`;

  const response = await fetch(`${DEFAULT_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0.2 },
    }),
  });

  if (!response.ok) throw new Error(`Ollama request failed with status ${response.status}`);

  const data = await response.json();
  const parsed = JSON.parse(data.response);

  const categoryInsights = Array.isArray(parsed.categoryInsights)
    ? parsed.categoryInsights.slice(0, 7).map((item) => ({
        name: String(item.name || ""),
        label: String(item.label || toDisplayName(item.name)),
        reasoning: String(item.reasoning || ""),
        actions: Array.isArray(item.actions) ? item.actions.slice(0, 2).map((x) => String(x)) : [],
        nextCheckInDays: Number(item.nextCheckInDays || 7),
      }))
    : [];

  return {
    summary: String(parsed.summary || ""),
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, 4).map((x) => String(x))
      : [],
    categoryInsights,
    nextCheckInDays: Number(parsed.nextCheckInDays || 7),
    disclaimer: String(parsed.disclaimer || "This is an early risk screening insight, not a medical diagnosis."),
    source: "ollama",
  };
}

async function explainRisk(report) {
  const useOllama = String(process.env.USE_OLLAMA || "true").toLowerCase() === "true";
  if (!useOllama) return fallbackExplanation(report);
  try {
    return await generateWithOllama(report);
  } catch (_err) {
    return fallbackExplanation(report);
  }
}

module.exports = { explainRisk };
