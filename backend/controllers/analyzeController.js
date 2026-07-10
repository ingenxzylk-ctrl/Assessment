import { GoogleGenAI } from "@google/genai";

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
].filter(Boolean);

const GEMINI_RETRIES = Number(process.env.GEMINI_RETRIES) || 1;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (err) => {
  const code = err?.status || err?.code;
  const msg = String(err?.message || "");
  return code === 429 || code === 503 || msg.includes("timed out") || msg.includes("ECONNRESET");
};

const formatGeminiError = (error) => {
  const msg = String(error?.message || error || "");

  if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID")) {
    return "Invalid GEMINI_API_KEY. Get a new key from https://aistudio.google.com/apikey and add it to backend/.env";
  }
  if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
    return "Backend cannot reach Google Gemini API. Check your internet connection and restart the backend server.";
  }
  if (msg.includes("not found") || msg.includes("NOT_FOUND") || msg.includes("is not supported")) {
    return `Gemini model not available. Set GEMINI_MODEL=gemini-2.5-flash in backend/.env and restart.`;
  }
  if (msg.includes("quota") || msg.includes("429")) {
    return "Gemini API quota exceeded. Wait a few minutes or check billing at Google AI Studio.";
  }

  return msg || "Diagnostics failed.";
};

const toInlineImagePart = (input) => {
  if (!input) return null;
  if (input.inlineData?.data) return input;

  let dataUrl = "";
  let mimeType = "image/jpeg";

  if (typeof input === "string") {
    if (input.startsWith("data:")) dataUrl = input;
    else return { inlineData: { mimeType, data: input.trim() } };
  } else if (typeof input === "object") {
    if (input.dataUrl) dataUrl = input.dataUrl;
    else if (input.previewUrl) dataUrl = input.previewUrl;
    else if (input.base64Data) {
      mimeType = input.mediaType || input.mimeType || "image/jpeg";
      return { inlineData: { mimeType, data: String(input.base64Data).trim() } };
    }
  }

  if (!dataUrl.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  return { inlineData: { mimeType: match[1], data: match[2].trim() } };
};

const callGemini = async (ai, model, payload, retries = GEMINI_RETRIES) => {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await ai.models.generateContent({ ...payload, model });
    } catch (err) {
      lastError = err;
      console.error(`Gemini call failed (model=${model}, attempt=${attempt + 1}):`, err?.message || err);
      if (!isRetryable(err) || attempt === retries - 1) throw err;
      await delay(2000 * (attempt + 1));
    }
  }
  throw lastError;
};

const callGeminiWithFallback = async (ai, payload) => {
  let lastError;
  for (const model of MODEL_CANDIDATES) {
    try {
      console.log(`Trying Gemini model: ${model}`);
      const response = await callGemini(ai, model, payload);
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

export const analyzeScalp = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_key_from_https://aistudio.google.com/apikey") {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing or still a placeholder. Add your real key to backend/.env and restart the server.",
      });
    }

    const ai = new GoogleGenAI({ apiKey });
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

    const analysisParts = [{ text: buildAnalysisPrompt(userGender, selfReportedStage) }];

    for (const img of labeledImages) {
      const part = toInlineImagePart(img.dataUrl);
      if (part) {
        analysisParts.push({ text: `\n[${String(img.type).toUpperCase()} VIEW]` });
        analysisParts.push(part);
      }
    }

    if (analysisParts.length < 2) {
      return res.status(400).json({ error: "Could not read image data. Please re-upload your photos." });
    }

    console.log(`Analyzing ${labeledImages.length} image(s)...`);
    const startTime = Date.now();

    const { response, model } = await callGeminiWithFallback(ai, {
      contents: [{ role: "user", parts: analysisParts }],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    console.log(`Gemini (${model}) responded in ${Date.now() - startTime}ms`);

    const responseText = response?.text?.trim();
    if (!responseText) {
      throw new Error("Gemini returned an empty response. Check image quality or API quota.");
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new Error("Gemini returned invalid JSON. Please try again.");
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
    };

    if (!result.aiPredictedStage) {
      throw new Error("AI response missing aiPredictedStage.");
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("analyzeScalp error:", error);
    return res.status(500).json({
      error: formatGeminiError(error),
      aiPredictedStage: null,
      analysisComplete: false,
    });
  }
};
