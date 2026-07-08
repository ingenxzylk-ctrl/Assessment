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
    if (input.startsWith("data:")) {
      dataUrl = input;
    } else {
      return { inlineData: { mimeType, data: input.trim() } };
    }
  } else if (typeof input === "object") {
    if (input.dataUrl) dataUrl = input.dataUrl;
    else if (input.previewUrl) dataUrl = input.previewUrl;
    else if (input.base64Data) {
      mimeType = input.mediaType || input.mimeType || "image/jpeg";
      return {
        inlineData: {
          mimeType,
          data: String(input.base64Data).trim(),
        },
      };
    }
  }

  if (!dataUrl.startsWith("data:")) return null;

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  return {
    inlineData: {
      mimeType: match[1],
      data: match[2].trim(),
    },
  };
};

const buildPrompt = (gender, selfReportedStage) => {
  if (gender === "female") {
    return `You are a professional trichologist. Analyze the scalp photos for a female patient.

Self-reported pattern (reference only): ${selfReportedStage || "unknown"}

Return ONLY valid JSON with exactly these keys:
{
  "finalStage": "string",
  "stageDescription": "string",
  "aiPredictedStage": "1|2|3|overall-thinning|patchy-bald",
  "aiConfidence": 0.0,
  "aiReasoning": "string",
  "requiresDoctorConsultation": false
}`;
  }

  return `You are a professional trichologist. Analyze the scalp photos for a male patient using the Norwood scale.

Self-reported stage (reference only): ${selfReportedStage || "unknown"}

Return ONLY valid JSON with exactly these keys:
{
  "finalStage": "string",
  "stageDescription": "string",
  "aiPredictedStage": "1|2|3|4|5|6|7|overall-thinning",
  "aiConfidence": 0.0,
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

const callGemini = async (ai, payload, retries = GEMINI_RETRIES) => {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await ai.models.generateContent(payload);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === retries - 1) throw err;
      const waitMs = 2000 * (attempt + 1);
      console.warn(`Gemini retry ${attempt + 1}/${retries} in ${waitMs}ms:`, err.message);
      await delay(waitMs);
    }
  }

  throw lastError;
};

export const analyzeScalp = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing in backend .env" });
    }

    const ai = new GoogleGenAI({ apiKey });

    const { gender, selfReportedStage, images, frontImage, topImage, sideImage, backImage } = req.body;
    const userGender = String(gender || "male").toLowerCase();

    const rawImages = [];

    if (Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        rawImages.push(img?.dataUrl || img?.previewUrl || img);
      }
    } else {
      if (frontImage) rawImages.push(frontImage);
      if (topImage) rawImages.push(topImage);
      if (sideImage) rawImages.push(sideImage);
      if (backImage) rawImages.push(backImage);
    }

    const imageParts = rawImages.map(toInlineImagePart).filter(Boolean);

    if (imageParts.length === 0) {
      return res.status(400).json({ error: "Valid scalp image(s) are required." });
    }

    console.log(`Calling ${GEMINI_MODEL} with ${imageParts.length} image(s)...`);

    const response = await callGemini(ai, {
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(userGender, selfReportedStage) }, ...imageParts],
        },
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
        thinkingConfig: {
          thinkingLevel: "minimal",
        },
      },
    });

    const responseText = response?.text?.trim();
    if (!responseText) {
      throw new Error("Gemini returned an empty response. Check image quality or API quota.");
    }

    const parsed = JSON.parse(responseText);

    const result = {
      finalStage: parsed.finalStage || parsed.aiPredictedStage || selfReportedStage || null,
      stageDescription: parsed.stageDescription || "",
      aiPredictedStage: parsed.aiPredictedStage || parsed.finalStage || null,
      aiConfidence: typeof parsed.aiConfidence === "number" ? parsed.aiConfidence : null,
      aiReasoning: parsed.aiReasoning || "",
      requiresDoctorConsultation: Boolean(parsed.requiresDoctorConsultation),
      selfReportedStage: selfReportedStage || null,
      gender: userGender,
      analysisComplete: true,
      model: GEMINI_MODEL,
    };

    if (!result.aiPredictedStage) {
      throw new Error("AI response missing aiPredictedStage.");
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("analyzeScalp error:", error);
    return res.status(500).json({
      error: error?.message || "Diagnostics failed.",
      aiPredictedStage: null,
      analysisComplete: false,
    });
  }
};