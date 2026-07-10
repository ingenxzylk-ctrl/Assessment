import OpenAI from "openai";

const MODEL_CANDIDATES = [
  process.env.OPENAI_MODEL,
  "gpt-4o",
  "gpt-4o-mini",
].filter(Boolean);

const OPENAI_RETRIES = Number(process.env.OPENAI_RETRIES) || 2;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (err) => {
  const code = err?.status || err?.code;
  const msg = String(err?.message || "");
  return code === 429 || code === 503 || msg.includes("timed out") || msg.includes("ECONNRESET");
};

const formatOpenAIError = (error) => {
  const msg = String(error?.message || error || "");

  if (msg.includes("Incorrect API key") || msg.includes("invalid_api_key")) {
    return "Invalid OPENAI_API_KEY. Get a key from https://platform.openai.com/api-keys and add it to backend/.env";
  }
  if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
    return "Backend cannot reach OpenAI API. Check your internet connection and restart the backend server.";
  }
  if (msg.includes("model") && (msg.includes("not found") || msg.includes("does not exist"))) {
    return "OpenAI model not available. Set OPENAI_MODEL=gpt-4o in backend/.env and restart.";
  }
  if (msg.includes("quota") || msg.includes("429") || msg.includes("rate limit")) {
    return "OpenAI API quota/rate limit exceeded. Wait a few minutes or check billing at platform.openai.com.";
  }

  return msg || "Diagnostics failed.";
};

const toDataUrl = (input) => {
  if (!input) return null;

  if (typeof input === "string") {
    if (input.startsWith("data:")) return input;
    return `data:image/jpeg;base64,${input.trim()}`;
  }

  if (typeof input === "object") {
    if (input.dataUrl) return input.dataUrl;
    if (input.previewUrl) return input.previewUrl;
    if (input.base64Data) {
      const mime = input.mediaType || input.mimeType || "image/jpeg";
      return `data:${mime};base64,${String(input.base64Data).trim()}`;
    }
  }

  return null;
};

const callOpenAI = async (client, model, messages, retries = OPENAI_RETRIES) => {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await client.chat.completions.create({
        model,
        messages,
        temperature: 0.1,
        response_format: { type: "json_object" },
      });
    } catch (err) {
      lastError = err;
      console.error(`OpenAI call failed (model=${model}, attempt=${attempt + 1}):`, err?.message || err);
      if (!isRetryable(err) || attempt === retries - 1) throw err;
      await delay(2000 * (attempt + 1));
    }
  }
  throw lastError;
};

const callOpenAIWithFallback = async (client, messages) => {
  let lastError;
  for (const model of MODEL_CANDIDATES) {
    try {
      console.log(`Trying OpenAI model: ${model}`);
      const response = await callOpenAI(client, model, messages);
      return { response, model };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

const IMAGE_VALIDATION_RULES = `
PHOTO VALIDATION (check first):
- ACCEPT: real human head/hair, ponytail side profiles, ponytail over shoulder
- REJECT ONLY: animals, cartoons, memes, random objects

If rejecting: {"valid": false, "imageRejected": true, "error": "reason", "aiPredictedStage": null}
If valid: set "valid": true and complete full analysis.
`;

const CLASSIFICATION_RULES = `
STAGE CLASSIFICATION — CRITICAL RULES:
1. aiPredictedStage MUST come ONLY from what you SEE in the photos (hairline, temples, crown, part-line, density).
2. NEVER copy the user's quiz answer into aiPredictedStage. The quiz may be wrong.
3. If photos show Stage 3 but the quiz says Stage 5, aiPredictedStage MUST be "3".
4. In aiReasoning, cite specific visible features (temple recession depth, crown thinning, bridge width).
5. aiConfidence: 0.9+ when photos are clear; 0.7–0.85 when partially obscured.
`;

const MALE_NORWOOD_GUIDE = `
Norwood (male) — classify from photos:
- 1: No recession
- 2: Slight temple recession
- 3: Deep M-shaped temples, frontal recession
- 4: Stage 3 + visible crown thinning
- 5: Larger front/crown bald areas, thin bridge between them
- 6: Bridge mostly gone
- 7: Horseshoe pattern only
- overall-thinning: diffuse thinning without classic Norwood pattern
`;

const FEMALE_LUDWIG_GUIDE = `
Ludwig (female) — classify from photos:
- 1: Minimal widening of central part
- 2: Noticeable part widening, reduced crown volume
- 3: Obvious diffuse thinning on crown/top
- overall-thinning: diffuse thinning across scalp
- patchy-bald: focal bald patches (alopecia)
`;

const buildAnalysisPrompt = (gender, selfReportedStage) => {
  const quizNote = selfReportedStage
    ? `User quiz answer (DO NOT use for aiPredictedStage — photos override quiz): ${selfReportedStage}`
    : "User quiz answer: not provided";

  if (gender === "female") {
    return `You are a professional trichologist analyzing female pattern hair loss (Ludwig scale).

${IMAGE_VALIDATION_RULES}
${CLASSIFICATION_RULES}
${FEMALE_LUDWIG_GUIDE}

3 photos: FRONT, SIDE (ponytail profile), BACK (ponytail aside).
${quizNote}

Return ONLY JSON:
{
  "valid": true,
  "imageRejected": false,
  "error": "",
  "finalStage": "string",
  "stageDescription": "string",
  "aiPredictedStage": "1|2|3|overall-thinning|patchy-bald",
  "aiConfidence": 0.85,
  "aiReasoning": "string",
  "requiresDoctorConsultation": false
}`;
  }

  return `You are a professional trichologist analyzing male pattern hair loss (Norwood scale).

${IMAGE_VALIDATION_RULES}
${CLASSIFICATION_RULES}
${MALE_NORWOOD_GUIDE}

Photos: front hairline + top/crown.
${quizNote}

Return ONLY JSON:
{
  "valid": true,
  "imageRejected": false,
  "error": "",
  "finalStage": "string",
  "stageDescription": "string",
  "aiPredictedStage": "1|2|3|4|5|6|7|overall-thinning",
  "aiConfidence": 0.85,
  "aiReasoning": "string",
  "requiresDoctorConsultation": false
}`;
};

const extractNumericStage = (value) => {
  const s = String(value || "").toLowerCase().trim();
  const direct = s.match(/^(\d)$/);
  if (direct) return direct[1];
  const labeled = s.match(/(?:norwood|ludwig|stage)\s*(\d)/);
  if (labeled) return labeled[1];
  return null;
};

const normalizeFemaleStage = (stage) => {
  const valid = ["1", "2", "3", "overall-thinning", "patchy-bald"];
  const s = String(stage || "").toLowerCase().trim();
  if (valid.includes(s)) return s;
  if (["i", "stage 1", "stage1", "ludwig 1"].includes(s)) return "1";
  if (["ii", "stage 2", "stage2", "ludwig 2"].includes(s)) return "2";
  if (["iii", "stage 3", "stage3", "ludwig 3"].includes(s)) return "3";
  if (s.includes("overall") || s.includes("diffuse")) return "overall-thinning";
  if (s.includes("patchy") || s.includes("alopecia")) return "patchy-bald";
  const numeric = extractNumericStage(stage);
  if (numeric && ["1", "2", "3"].includes(numeric)) return numeric;
  return null;
};

const normalizeMaleStage = (stage) => {
  const valid = ["1", "2", "3", "4", "5", "6", "7", "overall-thinning"];
  const s = String(stage || "").toLowerCase().trim();
  if (valid.includes(s)) return s;
  if (s.includes("overall") || s.includes("diffuse")) return "overall-thinning";
  const numeric = extractNumericStage(stage);
  if (numeric && valid.includes(numeric)) return numeric;
  return null;
};

const resolveVisualStage = (parsed, gender) => {
  const normalize = gender === "female" ? normalizeFemaleStage : normalizeMaleStage;
  const fromAi = normalize(parsed.aiPredictedStage);
  const fromFinal = normalize(parsed.finalStage);
  return fromAi || fromFinal || null;
};

const stagesDiffer = (a, b) => {
  if (!a || !b) return false;
  return String(a).toLowerCase() !== String(b).toLowerCase();
};

const parseLabeledImages = (images) => {
  if (!Array.isArray(images) || images.length === 0) return [];

  return images.map((img, index) => ({
    type: img.type || img.label || `image_${index + 1}`,
    label: img.label || img.type || `image_${index + 1}`,
    dataUrl: img.dataUrl || img.previewUrl || img,
  }));
};

const buildOpenAIMessages = (gender, selfReportedStage, labeledImages) => {
  const content = [
    { type: "text", text: buildAnalysisPrompt(gender, selfReportedStage) },
  ];

  for (const img of labeledImages) {
    const dataUrl = toDataUrl(img.dataUrl);
    if (!dataUrl) continue;

    content.push({ type: "text", text: `\n[${String(img.type).toUpperCase()} VIEW]` });
    content.push({
      type: "image_url",
      image_url: { url: dataUrl, detail: "low" },
    });
  }

  return [{ role: "user", content }];
};

export const analyzeScalp = async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "your_key_from_https://platform.openai.com/api-keys") {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing or still a placeholder. Add your real key to backend/.env and restart the server.",
      });
    }

    const client = new OpenAI({ apiKey });
    const { gender, selfReportedStage, images } = req.body;
    const userGender = String(gender || "male").toLowerCase();

    const labeledImages = parseLabeledImages(images);

    if (labeledImages.length === 0) {
      return res.status(400).json({ error: "Valid scalp image(s) are required." });
    }

    if (userGender === "female" && labeledImages.length < 3) {
      return res.status(400).json({
        error: "Female assessment requires 3 images: front, side (ponytail), and back.",
      });
    }

    const messages = buildOpenAIMessages(userGender, selfReportedStage, labeledImages);
    const imageCount = messages[0].content.filter((p) => p.type === "image_url").length;

    if (imageCount === 0) {
      return res.status(400).json({ error: "Could not read image data. Please re-upload your photos." });
    }

    console.log(`Analyzing ${imageCount} image(s) with OpenAI...`);
    const startTime = Date.now();

    const { response, model } = await callOpenAIWithFallback(client, messages);

    console.log(`OpenAI (${model}) responded in ${Date.now() - startTime}ms`);

    const responseText = response?.choices?.[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error("OpenAI returned an empty response. Check image quality or API quota.");
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new Error("OpenAI returned invalid JSON. Please try again.");
    }

    if (parsed.valid === false || parsed.imageRejected === true) {
      return res.status(422).json({
        error: parsed.error || parsed.reason || "Please upload photos of your own scalp/hair.",
        imageRejected: true,
      });
    }

    const aiPredictedStage = resolveVisualStage(parsed, userGender);
    const normalizedSelfReported = userGender === "female"
      ? normalizeFemaleStage(selfReportedStage)
      : normalizeMaleStage(selfReportedStage);

    const result = {
      finalStage: parsed.finalStage || aiPredictedStage,
      stageDescription: parsed.stageDescription || "",
      aiPredictedStage,
      aiConfidence: typeof parsed.aiConfidence === "number" ? parsed.aiConfidence : 0.85,
      aiReasoning: parsed.aiReasoning || "",
      requiresDoctorConsultation: Boolean(parsed.requiresDoctorConsultation),
      selfReportedStage: normalizedSelfReported || selfReportedStage || null,
      stageDiscrepancy: stagesDiffer(aiPredictedStage, normalizedSelfReported),
      gender: userGender,
      analysisComplete: true,
      model,
      provider: "openai",
    };

    if (!result.aiPredictedStage) {
      throw new Error("AI response missing aiPredictedStage.");
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("analyzeScalp error:", error);
    return res.status(500).json({
      error: formatOpenAIError(error),
      aiPredictedStage: null,
      analysisComplete: false,
    });
  }
};
