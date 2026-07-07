import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 90_000;
const GEMINI_RETRIES = Number(process.env.GEMINI_RETRIES) || 3;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = (promise, ms, label = "Gemini request") =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ]);

const isTimeoutError = (err) =>
  err?.message?.includes("timed out") ||
  err?.name === "AbortError" ||
  err?.code === "UND_ERR_HEADERS_TIMEOUT";

const isRetryableError = (err) =>
  err?.status === 503 || err?.status === 429 || isTimeoutError(err);

const extractResponseText = (response) => {
  if (response?.text) return response.text;
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((p) => p.text || "").join("").trim();
  }
  return "";
};

const formatGeminiPart = (base64DataUrl) => {
  const parts = base64DataUrl.split("base64,");
  const mimeTypeMatch = parts[0].match(/data:(image\/\w+);/);
  return {
    inlineData: {
      mimeType: mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg",
      data: parts[1].trim(),
    },
  };
};

const buildSystemPrompt = (userGender, selfReportedStage) => {
  if (userGender === "female") {
    return `You are a professional Trichologist. Analyze the provided images for a female patient.

Self-reported pattern (reference only): ${selfReportedStage || "unknown"}

Steps:
1. EVIDENCE: Examine central part-line width and crown density.
2. REASONING: Explain if thinning is diffuse or focal.
3. STAGE: Assign ONE value from: 1, 2, 3, overall-thinning, patchy-bald

Return strictly valid JSON with these exact keys:
{
  "finalStage": "string",
  "stageDescription": "string",
  "aiPredictedStage": "1|2|3|overall-thinning|patchy-bald",
  "aiConfidence": 0.0,
  "aiReasoning": "string",
  "requiresDoctorConsultation": false
}`;
  }

  return `You are a professional Trichologist. Analyze the provided images for a male patient (Norwood scale).

Self-reported stage (reference only): ${selfReportedStage || "unknown"}

Steps:
1. EVIDENCE: Examine temple recession and vertex thinning.
2. REASONING: Explain the hair loss pattern.
3. STAGE: Assign ONE value from: 1, 2, 3, 4, 5, 6, 7, overall-thinning

Return strictly valid JSON with these exact keys:
{
  "finalStage": "string",
  "stageDescription": "string",
  "aiPredictedStage": "1|2|3|4|5|6|7|overall-thinning",
  "aiConfidence": 0.0,
  "aiReasoning": "string",
  "requiresDoctorConsultation": false
}`;
};

const callGeminiWithRetry = async (ai, payload, retries = GEMINI_RETRIES) => {
  for (let i = 0; i < retries; i++) {
    try {
      const request = ai.models.generateContent({
        ...payload,
        config: {
          ...payload.config,
          httpOptions: {
            timeout: GEMINI_TIMEOUT_MS,
            headers: {},
            ...payload.config?.httpOptions,
          },
        },
      });

      return await withTimeout(
        request,
        GEMINI_TIMEOUT_MS + 5_000,
        "Gemini generateContent"
      );
    } catch (err) {
      if (isRetryableError(err) && i < retries - 1) {
        const waitTime = Math.pow(2, i) * 2_000;
        console.log(
          `⚠️ Gemini issue (${err.status || err.message}). Retrying in ${waitTime}ms... (attempt ${i + 1}/${retries})`
        );
        await delay(waitTime);
        continue;
      }

      console.error(
        `❌ Gemini call failed on attempt ${i + 1}/${retries}:`,
        err.message || err
      );
      throw err;
    }
  }
};

export const analyzeScalp = async (req, res) => {
  console.log("====================================");
  console.log("📥 INCOMING REAL-TIME AI SCALP SCAN DATA STREAM");

  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) throw new Error("GEMINI_API_KEY is missing.");

    console.log(
      `🔑 GEMINI_API_KEY loaded: ${API_KEY.slice(0, 6)}... (length ${API_KEY.length})`
    );

    const ai = new GoogleGenAI({
      apiKey: API_KEY,
      httpOptions: {
        timeout: GEMINI_TIMEOUT_MS,
        headers: {},
      },
    });

    const { images, frontImage, topImage, gender, selfReportedStage } = req.body;
    const userGender = String(gender || "male").toLowerCase();

    let inputImagesPool = [];
    if (Array.isArray(images) && images.length > 0) {
      inputImagesPool = images;
    } else {
      if (frontImage) inputImagesPool.push({ type: "front", dataUrl: frontImage });
      if (topImage) inputImagesPool.push({ type: "top", dataUrl: topImage });
    }

    if (inputImagesPool.length === 0) {
      return res.status(400).json({ error: "Scalp photographs are required." });
    }

    const formattedGeminiImageParts = inputImagesPool.map((img) =>
      formatGeminiPart(img.dataUrl || img)
    );

    const approxKB = Math.round(
      formattedGeminiImageParts.reduce(
        (sum, p) => sum + p.inlineData.data.length,
        0
      ) / 1024
    );

    console.log(
      `🧠 DEBUG: Dispatching ${formattedGeminiImageParts.length} images to Gemini (~${approxKB} KB base64 payload).`
    );

    const systemPrompt = buildSystemPrompt(userGender, selfReportedStage);

    console.log(
      `🧠 DISPATCHING TO ${GEMINI_MODEL} (Gender: ${userGender}, timeout: ${GEMINI_TIMEOUT_MS / 1000}s)...`
    );

    const response = await callGeminiWithRetry(ai, {
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt }, ...formattedGeminiImageParts],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const responseText = extractResponseText(response);
    console.log("🎯 RAW RESPONSE RECEIVED:", responseText);

    if (!responseText) {
      throw new Error("Gemini returned an empty response.");
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI response did not contain valid JSON structure.");
    }

    const cleanJson = jsonMatch[0]
      .replace(/,\s*([\]}])/g, "$1")
      .replace(/\\n/g, " ")
      .replace(/\s+/g, " ");

    const parsedResult = JSON.parse(cleanJson);

    const result = {
      finalStage: parsedResult.finalStage || parsedResult.aiPredictedStage || selfReportedStage,
      stageDescription: parsedResult.stageDescription || "",
      aiPredictedStage: parsedResult.aiPredictedStage || parsedResult.finalStage || null,
      aiConfidence:
        typeof parsedResult.aiConfidence === "number"
          ? parsedResult.aiConfidence
          : null,
      aiReasoning: parsedResult.aiReasoning || "",
      requiresDoctorConsultation: Boolean(parsedResult.requiresDoctorConsultation),
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
    console.error("❌ BACKEND PIPELINE EXCEPTION:", error);
    return res.status(500).json({
      error: error.message || "Diagnostics failed.",
      aiPredictedStage: null,
      analysisComplete: false,
    });
  }
};