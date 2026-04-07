require("dotenv").config();

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("./utils/db");
const { requireAuth } = require("./auth");
const { inferWithLayers } = require("./services/hybridInferenceService");
const { explainRisk } = require("./services/ollamaService");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

function parseJsonField(raw, fallback = {}) {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

function isInRange(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function validateIntake(symptoms, behavior) {
  if (!isInRange(symptoms.energyLevel, 1, 10)) {
    return "energyLevel must be between 1 and 10";
  }
  if (!isInRange(symptoms.sleepQuality, 1, 10)) {
    return "sleepQuality must be between 1 and 10";
  }
  if (!isInRange(symptoms.stressLevel, 1, 10)) {
    return "symptom stressLevel must be between 1 and 10";
  }
  if (!isInRange(symptoms.moodLevel, 1, 10)) {
    return "symptom moodLevel must be between 1 and 10";
  }
  if (!["physical", "mental", "both"].includes(String(symptoms.fatigueType || ""))) {
    return "fatigueType must be one of: physical, mental, both";
  }

  if (!isInRange(behavior.sleepHours, 0, 14)) {
    return "sleepHours must be between 0 and 14";
  }
  if (!isInRange(behavior.stressLevel, 1, 10)) {
    return "behavior stressLevel must be between 1 and 10";
  }
  if (!isInRange(behavior.exerciseMinutes, 0, 180)) {
    return "exerciseMinutes must be between 0 and 180";
  }
  if (!isInRange(behavior.moodLevel, 1, 10)) {
    return "behavior moodLevel must be between 1 and 10";
  }

  return null;
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "vitals-ai-mvp", timestamp: new Date().toISOString() });
});

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }

  const db = readDb();
  const existing = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    name: String(name),
    email: String(email).toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  writeDb(db);

  const token = createToken(user);
  return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const db = readDb();
  const user = db.users.find((u) => u.email === String(email).toLowerCase());
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createToken(user);
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post("/api/checks/full", requireAuth, upload.fields([
  { name: "voice", maxCount: 1 },
  { name: "vision", maxCount: 1 },
]), async (req, res) => {
  const requireVision = String(process.env.REQUIRE_VISION || "false").toLowerCase() === "true";
  const voiceFile = req.files?.voice?.[0] || null;
  const visionFile = req.files?.vision?.[0] || null;

  const symptoms = parseJsonField(req.body.symptoms, {});
  const behavior = parseJsonField(req.body.behavior, {});
  const voiceText = req.body.voiceText || "";

  if (!voiceFile) {
    return res.status(400).json({ error: "Voice recording is required" });
  }

  if (requireVision && !visionFile) {
    return res.status(400).json({ error: "Vision recording is required in strict mode" });
  }

  const intakeError = validateIntake(symptoms, behavior);
  if (intakeError) {
    return res.status(400).json({ error: intakeError });
  }

  const inference = await inferWithLayers({
    voiceFile,
    visionFile,
    symptoms,
    behavior,
    voiceText,
  });

  const { modalities, fusion, categories, categoryMap, source, layer, warnings } = inference;
  const voice = modalities.voice;
  const vision = modalities.vision;
  const symptom = modalities.symptom;
  const behaviorScore = modalities.behavior;

  const report = {
    id: uuidv4(),
    userId: req.user.id,
    createdAt: new Date().toISOString(),
    modalities,
    inferenceSource: source,
    inferenceLayer: layer,
    inferenceWarnings: warnings,
    fusion: {
      combinedScore: fusion.combinedScore,
      riskLevel: fusion.riskLevel,
      confidence: fusion.confidence,
    },
    categories,
    categoryMap,

    // Legacy compatibility fields for existing clients.
    voice,
    vision,
    symptom,
    behavior: behaviorScore,
    combinedScore: fusion.combinedScore,
    riskLevel: fusion.riskLevel,
  };

  const assistant = await explainRisk(report);

  const db = readDb();
  db.checks.push({ ...report, assistant });
  writeDb(db);

  return res.status(201).json({ ...report, assistant });
});

app.get("/api/checks/history", requireAuth, (req, res) => {
  const db = readDb();
  const checks = db.checks
    .filter((c) => c.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.json({ checks });
});

app.get("/api/checks/latest", requireAuth, (req, res) => {
  const db = readDb();
  const latest = db.checks
    .filter((c) => c.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

  return res.json({ latest });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`VITALS.AI MVP running on http://localhost:${port}`);
});
