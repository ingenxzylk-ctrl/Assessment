import { GoogleGenAI } from "@google/genai";

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-2.0-flash",
].filter(Boolean);

const GEMINI_RETRIES = Number(process.env.GEMINI_RETRIES) || 2;

const SEVERITY = { none: 0, mild: 1, moderate: 2, severe: 3 };

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
    return "Gemini model not available. Set GEMINI_MODEL=gemini-2.5-flash in backend/.env and restart.";
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

const extractResponseText = (response) => {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts.map((p) => p?.text || "").join("").trim();
    if (joined) return joined;
  }

  return "";
};

const stripJsonFences = (raw) => {
  let text = String(raw || "").trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return text;
};

const parseGeminiJson = (raw) => {
  const cleaned = stripJsonFences(raw);
  if (!cleaned) throw new Error("Empty Gemini response");

  const attempts = [
    cleaned,
    cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1),
    cleaned
      .slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1)
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]"),
  ].filter((s) => s && s.includes("{"));

  let lastError;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Invalid JSON");
};

const parseGeminiResponseWithRepair = async (ai, model, rawText) => {
  try {
    return parseGeminiJson(rawText);
  } catch (firstError) {
    console.warn("Gemini JSON parse failed, attempting repair...", firstError?.message);
    console.warn("Raw preview:", String(rawText).slice(0, 500));

    const repairResponse = await callGemini(ai, model, {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Convert the following into valid JSON only. No markdown, no code fences, no extra text. Return a single JSON object.\n\n${String(rawText).slice(0, 12000)}`,
            },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const repairedText = extractResponseText(repairResponse);
    if (!repairedText) throw firstError;
    return parseGeminiJson(repairedText);
  }
};

const buildAnalysisPrompt = (gender) => {
  if (gender === "female") {
    return `You are an expert trichologist. Classify female pattern hair loss ONLY from the patient's uploaded scalp photos.

Do NOT treat quiz answers, captions, or reference charts as ground truth. Classify only what is visible in the photos.

WORKFLOW:
1. FRONT photo → part-line width, frontal density
2. SIDE photo → temple/side density
3. BACK photo → crown density, patchy vs diffuse
4. Fill observations with what you actually see
5. Set aiPredictedStage so it is CONSISTENT with those observations — never default to stage 1 when thinning is visible

Ludwig scale:
- 1: Normal/narrow part, full crown
- 2: Clearly widened part OR reduced crown volume
- 3: Marked crown thinning / very wide part / sparse frontal density
- overall-thinning: diffuse thinning across scalp without a classic Ludwig part pattern
- patchy-bald: focal bald patches (alopecia-like)

CONSISTENCY RULES:
- partLineWidth=very_wide OR crownDensity=sparse → aiPredictedStage must be "3" (or patchy-bald if patches)
- partLineWidth=widened OR crownDensity=reduced → at least "2"
- pattern=patchy → aiPredictedStage must be "patchy-bald"
- Never output stage "1" if any observation shows widened/very_wide/reduced/sparse/patchy

PHOTO VALIDATION: reject animals/cartoons/objects only. Accept real human scalp/hair photos.

CRITICAL: Output ONE raw JSON object only. No markdown. No code fences.

{
  "valid": true,
  "imageRejected": false,
  "error": "",
  "observations": {
    "frontView": { "partLineWidth": "normal|widened|very_wide", "frontalDensity": "full|reduced|sparse" },
    "sideView": { "templeDensity": "full|reduced|sparse", "notes": "string" },
    "backView": { "crownDensity": "full|reduced|sparse", "pattern": "diffuse|patchy|normal" }
  },
  "aiPredictedStage": "1|2|3|overall-thinning|patchy-bald",
  "aiConfidence": 0.85,
  "aiReasoning": "string",
  "stageDescription": "string",
  "finalStage": "string",
  "requiresDoctorConsultation": false
}`;
  }

  return `You are an expert trichologist. Classify male pattern hair loss (Norwood) ONLY from the patient's uploaded scalp photos.

Do NOT treat quiz answers, captions, or Norwood reference charts as ground truth. Classify only what is visible in the photos.

WORKFLOW:
1. FRONT view → temple recession (left/right), hairline shape
2. TOP/CROWN view → crown baldness, visible scalp extent
3. Bridge between front and crown → full / thinning / absent
4. Fill observations honestly — advanced baldness must use severe/extensive/absent values
5. aiPredictedStage MUST match observations. NEVER default to "1" when significant loss is visible.

Norwood scale — be conservative; do NOT over-stage:
- 1: Full hairline, no recession, full crown
- 2: MINOR temple recession ONLY (slight M start). Crown FULL. Bridge FULL. Most of hairline still intact.
- 3: Clear deep M-shape temples. Crown still relatively FULL (no large bald patch on top).
- 4: Temple recession PLUS visible crown thinning starting (both areas affected).
- 5: LARGE bald areas at front AND crown, with only a THIN bridge of hair between them.
- 6: Bridge largely GONE; horseshoe forming; extensive top baldness
- 7: Narrow band on sides/back only; top completely bald
- overall-thinning: diffuse thinning without classic Norwood pattern

CRITICAL EARLY-STAGE RULES (avoid false stage 4/5):
- If crown is full/none and only temples are mildly receded → MUST be "2" (not 3/4/5)
- If crown thinning is absent/none and temples are moderate → "3" max
- Stage "4" requires BOTH temple recession AND real crown thinning
- Stage "5" requires LARGE front baldness AND LARGE crown baldness with thin bridge
- Do NOT call stage 5 just because temples look recessed in a front selfie
- Front-only photos without clear crown baldness should stay at 2–3

CONSISTENCY RULES (mandatory):
- midscalpBridge=absent OR (visibleScalp=extensive AND frontalHairline=receding_severe) → "6" or "7"
- crownThinning=severe AND temples moderate/severe AND bridge thinning → at least "5"
- temples mild + crown none + bridge full/not_visible → "1" or "2"
- Never output "4"/"5" if crownThinning is none/mild and visibleScalp is minimal
- crownThinning=mild with full bridge is NOT stage 4 — treat mild crown as noise
- Front hairline recession alone (no crown bald patch) = stage 2 or 3 ONLY

STAGE 7: horseshoe only / top fully bald → "7"

PHOTO VALIDATION: reject animals/cartoons/objects only. Accept real human scalp/hair photos.

CRITICAL: Output ONE raw JSON object only. No markdown. No code fences.

{
  "valid": true,
  "imageRejected": false,
  "error": "",
  "observations": {
    "frontView": {
      "templeRecessionLeft": "none|mild|moderate|severe",
      "templeRecessionRight": "none|mild|moderate|severe",
      "frontalHairline": "intact|receding_mild|receding_moderate|receding_severe"
    },
    "topView": {
      "crownThinning": "none|mild|moderate|severe",
      "visibleScalp": "minimal|partial|extensive"
    },
    "midscalpBridge": "full|thinning|absent|not_visible"
  },
  "aiPredictedStage": "1|2|3|4|5|6|7|overall-thinning",
  "aiConfidence": 0.85,
  "aiReasoning": "string",
  "stageDescription": "string",
  "finalStage": "Norwood Stage X",
  "requiresDoctorConsultation": false
}`;
};

const level = (value) => SEVERITY[String(value || "none").toLowerCase()] ?? 0;

const maxTempleRecession = (front = {}) =>
  Math.max(level(front.templeRecessionLeft), level(front.templeRecessionRight));

const hasCompleteMaleObservations = (observations = {}) => {
  const front = observations.frontView || {};
  const top = observations.topView || {};
  const hasFront = Boolean(
    front.templeRecessionLeft ||
    front.templeRecessionRight ||
    front.frontalHairline
  );
  const hasTop = Boolean(top.crownThinning || top.visibleScalp || observations.midscalpBridge);
  // Require both angles so partial Gemini output cannot drive stage alone
  return hasFront && hasTop;
};

const hasCompleteFemaleObservations = (observations = {}) => {
  const front = observations.frontView || {};
  const back = observations.backView || {};
  const side = observations.sideView || {};
  const hasFront = Boolean(front.partLineWidth || front.frontalDensity);
  const hasBackOrSide = Boolean(back.crownDensity || back.pattern || side.templeDensity);
  return hasFront && hasBackOrSide;
};

const hasClearCrownLoss = (observations = {}) => {
  const top = observations.topView || {};
  const bridge = String(observations.midscalpBridge || "not_visible").toLowerCase();
  const scalp = String(top.visibleScalp || "minimal").toLowerCase();
  const crown = level(top.crownThinning);
  // Mild crown alone is noise — need real thinning / visible scalp / bridge change
  return crown >= 2 || scalp === "partial" || scalp === "extensive" || bridge === "thinning" || bridge === "absent";
};

const hasStrongAdvancedEvidence = (observations = {}) => {
  const front = observations.frontView || {};
  const top = observations.topView || {};
  const bridge = String(observations.midscalpBridge || "").toLowerCase();
  const scalp = String(top.visibleScalp || "").toLowerCase();
  const hairline = String(front.frontalHairline || "").toLowerCase();
  const temples = maxTempleRecession(front);
  const crown = level(top.crownThinning);

  if (bridge === "absent") return true;
  if (scalp === "extensive" && (crown >= 2 || hairline.includes("severe") || temples >= 3)) return true;
  if (crown >= 3 && temples >= 3 && bridge === "thinning") return true;
  return false;
};

/** Full/near-full crown + intact bridge = early Norwood (1–3), regardless of temple labels */
const hasEarlyStageEvidence = (observations = {}) => {
  const top = observations.topView || {};
  const bridge = String(observations.midscalpBridge || "not_visible").toLowerCase();
  const scalp = String(top.visibleScalp || "minimal").toLowerCase();
  const crown = level(top.crownThinning);
  return crown <= 1 && scalp === "minimal" && bridge !== "absent" && bridge !== "thinning";
};

/** Map temples-only when crown is still full — never returns 4+ */
const stageFromTemplesOnly = (observations = {}) => {
  const front = observations.frontView || {};
  const hairline = String(front.frontalHairline || "").toLowerCase();
  const temples = maxTempleRecession(front);

  if (temples >= 2 || hairline.includes("moderate") || hairline.includes("severe")) return "3";
  if (temples === 1 || hairline.includes("mild") || hairline.includes("receding")) return "2";
  if (temples === 0 && (hairline.includes("intact") || !hairline)) return "1";
  return "2";
};

const computeMaleNorwoodFromObservations = (observations = {}) => {
  if (!hasCompleteMaleObservations(observations)) return null;

  const front = observations.frontView || {};
  const top = observations.topView || {};
  const bridge = String(observations.midscalpBridge || "not_visible").toLowerCase();
  const hairline = String(front.frontalHairline || "").toLowerCase();

  const temples = maxTempleRecession(front);
  const crown = level(top.crownThinning);
  const scalp = String(top.visibleScalp || "minimal").toLowerCase();
  const severeHairline = hairline.includes("severe");

  // HARD RULE: no clear crown/bridge loss → stage 1–3 from temples only
  // Fixes stage-2 hairlines wrongly labeled 4/5 because crown was marked "mild"
  if (!hasClearCrownLoss(observations)) {
    return stageFromTemplesOnly(observations);
  }

  // Stage 7: near-total top loss
  if (
    (bridge === "absent" && scalp === "extensive" && temples >= 3 && crown >= 3) ||
    (scalp === "extensive" && crown >= 3 && temples >= 3 && severeHairline)
  ) {
    return "7";
  }

  // Stage 6
  if (
    bridge === "absent" ||
    (scalp === "extensive" && crown >= 2 && (severeHairline || temples >= 3))
  ) {
    return "6";
  }

  // Stage 5: BOTH significant front AND crown loss
  if (
    temples >= 3 && crown >= 2 && (bridge === "thinning" || scalp === "partial" || scalp === "extensive")
  ) {
    return "5";
  }
  if (temples >= 2 && crown >= 3 && bridge === "thinning") return "5";

  // Stage 4: needs REAL crown thinning (moderate+), not mild noise
  if (temples >= 2 && crown >= 2) return "4";
  if (temples >= 2 && crown >= 2 && scalp === "partial") return "4";

  // Crown mild + temples → still early
  if (crown <= 1) return stageFromTemplesOnly(observations);

  if (temples >= 2 && crown === 0) return "3";
  if (temples <= 1 && crown === 0) return stageFromTemplesOnly(observations);

  return "3";
};

const computeFemaleLudwigFromObservations = (observations = {}) => {
  if (!hasCompleteFemaleObservations(observations)) return null;

  const front = observations.frontView || {};
  const back = observations.backView || {};
  const side = observations.sideView || {};

  const pattern = String(back.pattern || "normal").toLowerCase();
  if (pattern === "patchy") return "patchy-bald";

  const part = String(front.partLineWidth || "normal").toLowerCase();
  const crownSparse =
    String(back.crownDensity || "").toLowerCase() === "sparse" ||
    String(side.templeDensity || "").toLowerCase() === "sparse" ||
    String(front.frontalDensity || "").toLowerCase() === "sparse";

  if (part === "very_wide" || crownSparse) return "3";
  if (part === "widened" || String(back.crownDensity || "").toLowerCase() === "reduced") return "2";
  if (
    String(front.frontalDensity || "").toLowerCase() === "reduced" &&
    String(back.crownDensity || "").toLowerCase() === "reduced"
  ) {
    return "overall-thinning";
  }

  return "1";
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

/**
 * Reconcile AI stage with observation-based stage + soft self-report prior.
 * Prevents both under-classification (true stage 6→1) and over-classification (true stage 2→5).
 */
const reconcileStage = (
  aiStage,
  ruleStage,
  gender,
  observations,
  confidence = 0.85,
  selfReportedStage = null
) => {
  const normalize = gender === "female" ? normalizeFemaleStage : normalizeMaleStage;
  const ai = normalize(aiStage);
  const rule = normalize(ruleStage);
  const self = normalize(selfReportedStage);

  const obsComplete =
    gender === "female"
      ? hasCompleteFemaleObservations(observations)
      : hasCompleteMaleObservations(observations);

  if (!ai) return rule || self;

  // HARD CAP: no clear crown/bridge loss → temples-only stage (1–3).
  // Runs even when AI and rule agree on an inflated stage 4/5.
  if (gender === "male" && !hasClearCrownLoss(observations) && !hasStrongAdvancedEvidence(observations)) {
    const templeStage = stageFromTemplesOnly(observations);
    const templeNum = parseInt(templeStage, 10);
    const selfNumEarly = parseInt(self, 10);
    const aiNumEarly = parseInt(ai, 10);

    // Prefer temple mapping; if self-report is also early and within 1, keep temple stage
    if (!Number.isNaN(selfNumEarly) && selfNumEarly <= 3) {
      if (Math.abs(templeNum - selfNumEarly) <= 1) return templeStage;
      // Self said 3, temples say 2 → trust temples (photo) for mild recession
      if (templeNum <= selfNumEarly) return templeStage;
      return String(Math.min(3, selfNumEarly + 1));
    }

    // If AI is early too, pick the more conservative of AI vs temples
    if (!Number.isNaN(aiNumEarly) && aiNumEarly <= 3) {
      return String(Math.min(templeNum, aiNumEarly));
    }

    return templeStage;
  }

  if (!rule || !obsComplete) {
    if (self && gender === "male") {
      const aiNum = parseInt(ai, 10);
      const selfNum = parseInt(self, 10);
      if (!Number.isNaN(aiNum) && !Number.isNaN(selfNum) && aiNum - selfNum >= 2 && aiNum >= 4) {
        return String(Math.min(aiNum, selfNum + 1));
      }
    }
    return ai;
  }
  if (ai === rule) return ai;

  if (rule === "patchy-bald" || ai === "patchy-bald") {
    return rule === "patchy-bald" ? rule : ai;
  }
  if (rule === "overall-thinning" || ai === "overall-thinning") {
    const ruleNum = parseInt(rule, 10);
    const aiNum = parseInt(ai, 10);
    if (!Number.isNaN(ruleNum) && ruleNum >= 3) return rule;
    if (!Number.isNaN(aiNum) && aiNum >= 3) return ai;
    return ai === "overall-thinning" ? ai : rule;
  }

  const aiNum = parseInt(ai, 10);
  const ruleNum = parseInt(rule, 10);
  const selfNum = parseInt(self, 10);
  const strongAdvanced = gender === "male" && hasStrongAdvancedEvidence(observations);
  const earlyEvidence = gender === "male" && hasEarlyStageEvidence(observations);

  if (!Number.isNaN(aiNum) && !Number.isNaN(ruleNum)) {
    const gap = Math.abs(aiNum - ruleNum);
    const higher = Math.max(aiNum, ruleNum);
    const lower = Math.min(aiNum, ruleNum);

    // True advanced loss with strong visual evidence
    if (strongAdvanced && higher >= 5) return String(higher);

    // Early-stage photos (full crown): force temples-only, never 4+
    if (earlyEvidence && !strongAdvanced) {
      const templeStage = stageFromTemplesOnly(observations);
      const templeNum = parseInt(templeStage, 10);
      if (!Number.isNaN(selfNum) && selfNum <= 3) {
        if (Math.abs(templeNum - selfNum) <= 1) return templeStage;
        return templeNum <= selfNum ? templeStage : String(Math.min(3, selfNum));
      }
      return templeStage;
    }

    // Cap stage 4 claims without clear crown loss
    if (higher >= 4 && !hasClearCrownLoss(observations) && !strongAdvanced) {
      return stageFromTemplesOnly(observations);
    }

    // One source says 5+ but the other says early (1–3) without strong advanced evidence
    if (higher >= 5 && lower <= 3 && !strongAdvanced) {
      if (!Number.isNaN(selfNum) && selfNum <= 3) return String(Math.max(lower, Math.min(selfNum, 3)));
      return String(lower);
    }

    // Both advanced with strong evidence already handled; if both say 5+ without strong evidence, temper
    if (aiNum >= 5 && ruleNum >= 5 && !strongAdvanced) {
      if (!Number.isNaN(selfNum) && selfNum <= 3) return String(Math.min(3, Math.max(selfNum, 2)));
      return "3";
    }

    if (aiNum >= 5 && ruleNum >= 5) return String(higher);

    // Large gap without strong advanced evidence → prefer lower (conservative)
    if (gap >= 2 && !strongAdvanced) {
      if (!Number.isNaN(selfNum)) {
        // Pick the candidate closer to self-report
        return Math.abs(aiNum - selfNum) <= Math.abs(ruleNum - selfNum) ? ai : rule;
      }
      return String(lower);
    }

    if (gap === 1 && aiNum > ruleNum && confidence < 0.75) return rule;
    if (gap === 1 && ruleNum > aiNum && earlyEvidence) return ai;

    // Soft prior: if self-report within 1 of lower candidate and higher is 4+, prefer lower
    if (
      !Number.isNaN(selfNum) &&
      higher >= 4 &&
      Math.abs(selfNum - lower) <= 1 &&
      selfNum <= 3 &&
      !strongAdvanced
    ) {
      return String(Math.max(lower, selfNum));
    }

    return ai;
  }

  return ai;
};

const normalizeStageForGender = (stage, gender) =>
  gender === "female" ? normalizeFemaleStage(stage) : normalizeMaleStage(stage);

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

const buildGeminiParts = (gender, labeledImages) => {
  const parts = [{ text: buildAnalysisPrompt(gender) }];

  for (const img of labeledImages) {
    const imagePart = toInlineImagePart(img.dataUrl);
    if (!imagePart) continue;

    parts.push({ text: `\n[${String(img.type).toUpperCase()} VIEW]` });
    parts.push(imagePart);
  }

  return parts;
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

    const analysisParts = buildGeminiParts(userGender, labeledImages);
    const imageCount = analysisParts.filter((p) => p.inlineData).length;

    if (imageCount === 0) {
      return res.status(400).json({ error: "Could not read image data. Please re-upload your photos." });
    }

    console.log(`Analyzing ${imageCount} image(s) with Gemini...`);
    const startTime = Date.now();

    const { response, model } = await callGeminiWithFallback(ai, {
      contents: [{ role: "user", parts: analysisParts }],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    console.log(`Gemini (${model}) responded in ${Date.now() - startTime}ms`);

    const responseText = extractResponseText(response);
    if (!responseText) {
      throw new Error("Gemini returned an empty response. Check image quality or API quota.");
    }

    let parsed;
    try {
      parsed = await parseGeminiResponseWithRepair(ai, model, responseText);
    } catch (parseError) {
      console.error("Gemini JSON parse failed. Raw response:", responseText.slice(0, 1000));
      throw new Error("Gemini returned invalid JSON. Please try again.");
    }

    if (parsed.valid === false || parsed.imageRejected === true) {
      return res.status(422).json({
        error: parsed.error || parsed.reason || "Please upload photos of your own scalp/hair.",
        imageRejected: true,
      });
    }

    const observations = parsed.observations || {};
    const ruleBasedStage =
      userGender === "female"
        ? computeFemaleLudwigFromObservations(observations)
        : computeMaleNorwoodFromObservations(observations);

    const rawAiStage =
      normalizeStageForGender(parsed.aiPredictedStage, userGender) ||
      normalizeStageForGender(parsed.finalStage, userGender);

    const confidence = typeof parsed.aiConfidence === "number" ? parsed.aiConfidence : 0.85;
    const normalizedSelfReported = normalizeStageForGender(selfReportedStage, userGender);

    const aiPredictedStage = reconcileStage(
      rawAiStage,
      ruleBasedStage,
      userGender,
      observations,
      confidence,
      normalizedSelfReported || selfReportedStage
    );

    const stageNum = parseInt(aiPredictedStage, 10);
    const requiresDoctor =
      Boolean(parsed.requiresDoctorConsultation) ||
      (userGender === "male" && !Number.isNaN(stageNum) && stageNum >= 6) ||
      (userGender === "female" && aiPredictedStage === "patchy-bald");

    const result = {
      finalStage: parsed.finalStage || `Norwood Stage ${aiPredictedStage}`,
      stageDescription: parsed.stageDescription || "",
      aiPredictedStage,
      rawAiStage: rawAiStage || null,
      ruleBasedStage: ruleBasedStage || null,
      observations,
      stageAdjusted: rawAiStage && aiPredictedStage !== rawAiStage,
      aiConfidence: confidence,
      aiReasoning: parsed.aiReasoning || "",
      requiresDoctorConsultation: requiresDoctor,
      selfReportedStage: normalizedSelfReported || selfReportedStage || null,
      stageDiscrepancy: stagesDiffer(aiPredictedStage, normalizedSelfReported),
      gender: userGender,
      analysisComplete: true,
      model,
      provider: "gemini",
    };

    console.log("Stage result:", {
      gender: userGender,
      rawAiStage,
      ruleBasedStage,
      final: aiPredictedStage,
      confidence,
      observationsComplete:
        userGender === "female"
          ? hasCompleteFemaleObservations(observations)
          : hasCompleteMaleObservations(observations),
    });

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