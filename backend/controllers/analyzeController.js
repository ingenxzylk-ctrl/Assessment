import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_RETRIES = Number(process.env.GEMINI_RETRIES) || 2;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (err) => {
  const code = err?.status || err?.code;
  const msg = String(err?.message || "");
  return code === 429 || code === 503 || msg.includes("timed out") || msg.includes("ECONNRESET");
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

const callGemini = async (ai, payload, retries = GEMINI_RETRIES) => {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await ai.models.generateContent(payload);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === retries - 1) throw err;
      await delay(2000 * (attempt + 1));
    }
  }
  throw lastError;
};

/** Only rejects animals/objects — NOT ponytail angles */
const validateHumanPhotos = async (ai, labeledImages) => {
  const parts = [
    {
      text: `Check if ALL images show a real human person's head, face, or hair.

ALWAYS ACCEPT:
- Ponytail side profile photos
- Ponytail swept over shoulder
- Any human hair/scalp photo at any angle

ONLY REJECT if clearly an animal, cartoon, meme, or object with NO human head.

Do NOT reject because crown or part-line is not visible.

Return ONLY JSON: {"valid": true} or {"valid": false, "reason": "..."}`,
    },
  ];

  for (const img of labeledImages) {
    const part = toInlineImagePart(img.dataUrl || img);
    if (part) {
      parts.push({ text: `[Slot: ${img.type}]` });
      parts.push(part);
    }
  }

  const response = await callGemini(ai, {
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts }],
    config: { temperature: 0, responseMimeType: "application/json" },
  });

  try {
    const parsed = JSON.parse(response?.text?.trim() || "{}");
    return { valid: parsed.valid !== false, reason: parsed.reason || "" };
  } catch {
    return { valid: true };
  }
};

const buildAnalysisPrompt = (gender, selfReportedStage) => {
  if (gender === "female") {
    return `You are a trichologist analyzing female hair loss (Ludwig scale).

3 photos provided:
1. FRONT — hairline
2. SIDE — ponytail side profile (VALID format)
3. BACK — ponytail swept aside OR angled to show crown/part-line (ponytail side angles are VALID)

Self-reported: ${selfReportedStage || "unknown"}

Return ONLY JSON:
{
  "finalStage": "string",
  "stageDescription": "string",
  "aiPredictedStage": "1|2|3|overall-thinning|patchy-bald",
  "aiConfidence": 0.85,
  "aiReasoning": "string",
  "requiresDoctorConsultation": false
}`;
  }

  return `You are a trichologist analyzing male hair loss (Norwood scale).
Self-reported: ${selfReportedStage || "unknown"}

Return ONLY JSON:
{
  "finalStage": "string",
  "stageDescription": "string",
  "aiPredictedStage": "1|2|3|4|5|6|7|overall-thinning",
  "aiConfidence": 0.85,
  "aiReasoning": "string",
  "requiresDoctorConsultation": false
}`;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    finalStage: { type: "string" },
    stageDescription: { type: "string" },
    aiPredictedStage: { type: "string" },
    aiConfidence: { type: "number" },
    aiReasoning: { type: "string" },
    requiresDoctorConsultation: { type: "boolean" },
  },
  required: ["aiPredictedStage", "aiConfidence", "aiReasoning"],
};

const normalizeFemaleStage = (stage, selfReported) => {
  const valid = ["1", "2", "3", "overall-thinning", "patchy-bald"];
  const s = String(stage || "").toLowerCase().trim();
  if (valid.includes(s)) return s;
  if (["i", "stage 1", "stage1"].includes(s)) return "1";
  if (["ii", "stage 2", "stage2"].includes(s)) return "2";
  if (["iii", "stage 3", "stage3"].includes(s)) return "3";
  if (s.includes("overall") || s.includes("diffuse")) return "overall-thinning";
  if (s.includes("patchy") || s.includes("alopecia")) return "patchy-bald";
  return selfReported || "1";
};

export const analyzeScalp = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing in backend .env" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const { gender, selfReportedStage, images } = req.body;
    const userGender = String(gender || "male").toLowerCase();

    const labeledImages = (images || []).map((img, i) => ({
      type: img.type || img.label || `image_${i + 1}`,
      label: img.label || img.type || `image_${i + 1}`,
      dataUrl: img.dataUrl || img.previewUrl || img,
    }));

    if (labeledImages.length === 0) {
      return res.status(400).json({ error: "Valid scalp image(s) are required." });
    }

    if (userGender === "female" && labeledImages.length < 3) {
      return res.status(400).json({ error: "Female assessment requires 3 images." });
    }

    const humanCheck = await validateHumanPhotos(ai, labeledImages);
    if (!humanCheck.valid) {
      return res.status(422).json({
        error: humanCheck.reason || "Please upload photos of your own hair/scalp.",
        imageRejected: true,
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

    const response = await callGemini(ai, {
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: analysisParts }],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    });

    const responseText = response?.text?.trim();
    if (!responseText) throw new Error("Gemini returned an empty response.");

    const parsed = JSON.parse(responseText);
    let aiPredictedStage = parsed.aiPredictedStage || parsed.finalStage || null;

    if (userGender === "female") {
      aiPredictedStage = normalizeFemaleStage(aiPredictedStage, selfReportedStage);
    }

    return res.status(200).json({
      finalStage: parsed.finalStage || aiPredictedStage,
      stageDescription: parsed.stageDescription || "",
      aiPredictedStage,
      aiConfidence: typeof parsed.aiConfidence === "number" ? parsed.aiConfidence : 0.85,
      aiReasoning: parsed.aiReasoning || "",
      requiresDoctorConsultation: Boolean(parsed.requiresDoctorConsultation),
      selfReportedStage: selfReportedStage || null,
      gender: userGender,
      analysisComplete: true,
      model: GEMINI_MODEL,
    });
  } catch (error) {
    console.error("analyzeScalp error:", error);
    return res.status(500).json({
      error: error?.message || "Diagnostics failed.",
      aiPredictedStage: null,
      analysisComplete: false,
    });
  }
};