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
    return `You are an expert trichologist. Your ONLY job is to classify female pattern hair loss from the uploaded scalp PHOTO PIXELS.

IMAGE-FIRST RULES (mandatory):
- Ground truth = what is visible in the photos. Ignore quiz answers, captions, filenames, and reference charts.
- Fill observations FIRST from each labeled view, then set aiPredictedStage so it MATCHES those observations.
- Never invent thinning that is not visible. Never ignore thinning that is clearly visible.
- Prefer the LOWER stage when a photo is blurry, dark, angled, or partially occluded.

WORKFLOW (per labeled image):
1. FRONT → part-line width, frontal density
2. SIDE → temple/side density
3. BACK → crown density, patchy vs diffuse
4. Set aiPredictedStage consistent with observations
5. Set aiConfidence from IMAGE QUALITY + how clearly the stage features are visible (not a fixed 0.85)

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

CONFIDENCE CALIBRATION (aiConfidence 0.0–1.0):
- 0.90–0.98: sharp, well-lit photos; all key views clear; stage features unambiguous
- 0.75–0.89: usable photos; minor blur/angle; stage clear within ±1
- 0.55–0.74: one view missing/poor; features borderline between two stages
- below 0.55: heavy occlusion, extreme angle, or insufficient scalp visibility

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
  "imageQuality": "good|fair|poor",
  "aiReasoning": "Cite visible photo evidence only (part line, crown, density).",
  "stageDescription": "string",
  "finalStage": "string",
  "requiresDoctorConsultation": false
}`;
  }

  return `You are an expert trichologist. Your ONLY job is to classify male pattern hair loss (Norwood) from the uploaded scalp PHOTO PIXELS.

IMAGE-FIRST RULES (mandatory):
- Ground truth = what is visible in the photos. Ignore quiz answers, captions, filenames, and Norwood charts.
- Fill observations FIRST from each labeled view, then set aiPredictedStage so it MATCHES those observations.
- Never invent crown baldness from a front selfie alone. Never invent deep temple recession from soft lighting.
- Prefer the LOWER stage when a photo is blurry, dark, angled, or the crown/bridge is not clearly visible.

WORKFLOW (per labeled image):
1. FRONT → temple recession (left/right), hairline shape
2. TOP/CROWN → crown baldness, visible scalp extent
3. Mid-scalp bridge between front and crown → full / thinning / absent / not_visible
4. Set aiPredictedStage consistent with observations
5. Set aiConfidence from IMAGE QUALITY + how clearly stage features are visible (not a fixed 0.85)

Norwood scale — be conservative; do NOT over-stage:
- 1: Full hairline, no recession, full crown
- 2: MINOR temple recession ONLY (slight M start). Crown FULL. Bridge FULL. Most of hairline still intact.
- 3: Clear deep M-shape temples. Crown still relatively FULL (no large bald patch on top).
- 4: Temple recession PLUS visible crown thinning starting (both areas affected).
- 5: LARGE bald areas at front AND crown, with only a THIN bridge of hair between them.
- 6: Bridge largely GONE; horseshoe forming; extensive top baldness
- 7: Narrow band on sides/back only; top completely bald
- overall-thinning: diffuse thinning without classic Norwood pattern

CRITICAL EARLY-STAGE RULES (avoid false stage 3/4/5):
- Prefer the LOWER stage when unsure between 2 and 3
- Stage 2: slight temple recession / soft M / adult hairline with minor corners — crown FULL
- Stage 3: DEEP clear triangular temple recession (obvious M), still with full crown
- Do NOT call stage 3 for mild or borderline temple recession
- If only the front hairline looks slightly recessed and crown is full → "2"
- If crown thinning is absent/none → never above "3"
- Stage "4" requires BOTH temple recession AND real crown thinning visible in the TOP view
- Stage "5" requires LARGE front baldness AND LARGE crown baldness with thin bridge
- Do NOT call stage 5 just because temples look recessed in a front selfie
- Front-only photos without clear crown baldness should stay at 2 (or 3 only if deep M)

CONSISTENCY RULES (mandatory):
- midscalpBridge=absent OR (visibleScalp=extensive AND frontalHairline=receding_severe) → "6" or "7"
- crownThinning=severe AND temples moderate/severe AND bridge thinning → at least "5"
- temples mild/none + crown none + bridge full → "1" or "2"
- temples moderate on only one side OR hairline receding_mild/receding_moderate with full crown → "2" (not 3)
- Never output "4"/"5" if crownThinning is none/mild and visibleScalp is minimal
- crownThinning=mild with full bridge is NOT stage 4 — treat mild crown as noise
- Front hairline recession alone (no crown bald patch) = stage 2, or 3 only if deep bilateral M
- When uncertain between "2" and "3", output "2"
- If midscalpBridge cannot be seen, set midscalpBridge="not_visible" and do not invent bridge loss

CONFIDENCE CALIBRATION (aiConfidence 0.0–1.0):
- 0.90–0.98: sharp, well-lit front + crown; bridge assessable; stage features unambiguous
- 0.75–0.89: usable photos; minor blur/angle; stage clear within ±1
- 0.55–0.74: missing crown/bridge view OR borderline between two stages
- below 0.55: heavy occlusion, extreme angle, or insufficient scalp visibility

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
  "imageQuality": "good|fair|poor",
  "aiReasoning": "Cite visible photo evidence only (temples, crown, bridge, scalp).",
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

/** Map temples-only when crown is still full — never returns 4+.
 * Conservative: Gemini often labels mild Stage-2 temples as "moderate".
 * Stage 3 requires a clear deep bilateral M or severe recession.
 */
const stageFromTemplesOnly = (observations = {}) => {
  const front = observations.frontView || {};
  const hairline = String(front.frontalHairline || "").toLowerCase();
  const left = level(front.templeRecessionLeft);
  const right = level(front.templeRecessionRight);
  const temples = Math.max(left, right);
  const bilateralDeep = left >= 2 && right >= 2;
  const severeHairline = hairline === "receding_severe" || hairline.includes("severe");

  // Stage 3 only for clear deep M (not a single moderate label)
  if (temples >= 3 || severeHairline || (bilateralDeep && temples >= 2 && hairline.includes("moderate"))) {
    return "3";
  }

  // Mild / unilateral moderate / soft recession → Stage 2
  if (
    temples >= 1 ||
    hairline.includes("receding_mild") ||
    hairline.includes("receding_moderate") ||
    hairline.includes("mild") ||
    hairline.includes("receding")
  ) {
    return "2";
  }

  if (temples === 0 && (hairline.includes("intact") || !hairline)) return "1";
  return "2";
};

/** Conservative early pick from IMAGE evidence only (ignore quiz self-report). */
const pickConservativeEarlyStage = (templeStage, aiStage) => {
  const templeNum = parseInt(templeStage, 10);
  const aiNum = parseInt(aiStage, 10);

  // Temples-only mapping is the image ground truth for early stages
  if (!Number.isNaN(templeNum) && templeNum >= 1 && templeNum <= 3) {
    // Never escalate past temple evidence from an AI label alone
    if (!Number.isNaN(aiNum) && aiNum > templeNum && templeNum <= 2) return String(templeNum);
    return String(templeNum);
  }

  if (!Number.isNaN(aiNum) && aiNum >= 1 && aiNum <= 3) return String(Math.min(3, aiNum));
  return templeStage || "2";
};

/**
 * Calibrate reported accuracy from IMAGE evidence quality — not quiz answers.
 * Combines model-reported confidence with observation completeness and AI↔rule agreement.
 */
const calibrateConfidence = ({
  modelConfidence,
  imageQuality,
  gender,
  observations,
  aiStage,
  ruleStage,
  finalStage,
  imageCount,
}) => {
  let score =
    typeof modelConfidence === "number" && !Number.isNaN(modelConfidence)
      ? Math.min(0.98, Math.max(0.35, modelConfidence))
      : 0.75;

  const quality = String(imageQuality || "").toLowerCase();
  if (quality === "good") score += 0.04;
  else if (quality === "fair") score -= 0.04;
  else if (quality === "poor") score -= 0.12;

  const obsComplete =
    gender === "female"
      ? hasCompleteFemaleObservations(observations)
      : hasCompleteMaleObservations(observations);

  if (!obsComplete) score -= 0.12;
  else score += 0.03;

  if (gender === "male") {
    const bridge = String(observations?.midscalpBridge || "not_visible").toLowerCase();
    if (bridge === "not_visible" || !bridge) score -= 0.06;
    if (!hasClearCrownLoss(observations) && parseInt(finalStage, 10) >= 4) score -= 0.1;
  }

  if (typeof imageCount === "number") {
    if (imageCount >= 3) score += 0.03;
    else if (imageCount === 1) score -= 0.08;
  }

  const ai = String(aiStage || "").toLowerCase();
  const rule = String(ruleStage || "").toLowerCase();
  const final = String(finalStage || "").toLowerCase();

  if (rule && ai && rule === ai) score += 0.06;
  else if (rule && ai && rule !== ai) {
    const aiNum = parseInt(ai, 10);
    const ruleNum = parseInt(rule, 10);
    if (!Number.isNaN(aiNum) && !Number.isNaN(ruleNum)) {
      const gap = Math.abs(aiNum - ruleNum);
      if (gap >= 2) score -= 0.1;
      else if (gap === 1) score -= 0.04;
    } else {
      score -= 0.05;
    }
  }

  // Final stage forced away from raw AI → slightly lower confidence
  if (ai && final && ai !== final) score -= 0.05;

  return Math.round(Math.min(0.97, Math.max(0.4, score)) * 100) / 100;
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
 * IMAGE-FIRST reconciliation.
 * Stage is driven by photo observations (+ AI label consistency).
 * Quiz self-report is NEVER used to pick or override the stage — only for discrepancy metadata.
 */
const reconcileStage = (
  aiStage,
  ruleStage,
  gender,
  observations,
  confidence = 0.85
) => {
  const normalize = gender === "female" ? normalizeFemaleStage : normalizeMaleStage;
  const ai = normalize(aiStage);
  const rule = normalize(ruleStage);

  const obsComplete =
    gender === "female"
      ? hasCompleteFemaleObservations(observations)
      : hasCompleteMaleObservations(observations);

  // Prefer observation-derived stage when photos yielded complete structured findings
  const imagePrimary = obsComplete && rule ? rule : null;

  // HARD CAP: no clear crown/bridge loss → temples-only stage (1–3).
  // Runs even when AI and rule agree on an inflated stage 4/5.
  if (gender === "male" && !hasClearCrownLoss(observations) && !hasStrongAdvancedEvidence(observations)) {
    const templeStage = stageFromTemplesOnly(observations);
    return pickConservativeEarlyStage(templeStage, ai || imagePrimary);
  }

  if (!ai && !imagePrimary) return null;
  if (!ai) return imagePrimary;
  if (!imagePrimary) return ai;
  if (ai === imagePrimary) return ai;

  if (rule === "patchy-bald" || ai === "patchy-bald") {
    return rule === "patchy-bald" ? rule : ai;
  }
  if (rule === "overall-thinning" || ai === "overall-thinning") {
    const ruleNum = parseInt(rule, 10);
    const aiNum = parseInt(ai, 10);
    if (!Number.isNaN(ruleNum) && ruleNum >= 3) return rule;
    if (!Number.isNaN(aiNum) && aiNum >= 3) return ai;
    // Prefer observation-derived special pattern when present
    return rule === "overall-thinning" ? rule : ai;
  }

  const aiNum = parseInt(ai, 10);
  const ruleNum = parseInt(rule, 10);
  const strongAdvanced = gender === "male" && hasStrongAdvancedEvidence(observations);
  const earlyEvidence = gender === "male" && hasEarlyStageEvidence(observations);

  if (!Number.isNaN(aiNum) && !Number.isNaN(ruleNum)) {
    const gap = Math.abs(aiNum - ruleNum);
    const higher = Math.max(aiNum, ruleNum);
    const lower = Math.min(aiNum, ruleNum);

    // True advanced loss with strong visual evidence → trust higher image signal
    if (strongAdvanced && higher >= 5) return String(higher);

    // Early-stage photos (full crown): force temples-only, never 4+
    if (earlyEvidence && !strongAdvanced) {
      const templeStage = stageFromTemplesOnly(observations);
      return pickConservativeEarlyStage(templeStage, ai);
    }

    // Cap stage 4+ claims without clear crown loss in the photos
    if (higher >= 4 && !hasClearCrownLoss(observations) && !strongAdvanced) {
      return stageFromTemplesOnly(observations);
    }

    // One source says 5+ but the other says early (1–3) without strong advanced evidence
    if (higher >= 5 && lower <= 3 && !strongAdvanced) {
      return String(lower);
    }

    // Both advanced without strong photo evidence → temper to early/mid
    if (aiNum >= 5 && ruleNum >= 5 && !strongAdvanced) {
      return "3";
    }

    if (aiNum >= 5 && ruleNum >= 5) return String(higher);

    // Large gap: prefer observation-derived (image) stage
    if (gap >= 2) {
      if (strongAdvanced) return String(Math.max(ruleNum, aiNum));
      return rule; // image observations win
    }

    // Adjacent disagreement: lean on observations; use AI only if high confidence and rule is lower
    if (gap === 1) {
      if (confidence >= 0.85 && aiNum > ruleNum && !earlyEvidence) return ai;
      return rule;
    }

    return rule;
  }

  // Non-numeric specials already handled; default to image observations
  return imagePrimary || ai;
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

const VIEW_FOCUS = {
  front: "Focus on hairline shape and left/right temple recession only. Do not invent crown baldness from this angle.",
  side: "Focus on temple/side density and hairline profile. Note lighting/angle limits.",
  back: "Focus on crown/vertex density and whether thinning is diffuse or patchy.",
  top: "Focus on crown thinning, visible scalp extent, and whether a mid-scalp bridge is visible.",
  crown: "Focus on crown thinning, visible scalp extent, and whether a mid-scalp bridge is visible.",
  vertex: "Focus on crown/vertex density and visible scalp.",
};

const buildGeminiParts = (gender, labeledImages) => {
  const parts = [{ text: buildAnalysisPrompt(gender) }];

  for (const img of labeledImages) {
    const imagePart = toInlineImagePart(img.dataUrl);
    if (!imagePart) continue;

    const viewKey = String(img.type || img.label || "").toLowerCase();
    const focus =
      VIEW_FOCUS[viewKey] ||
      "Describe only what is clearly visible in this photo. If a region is not visible, mark it not_visible / unknown — do not guess.";

    parts.push({
      text: `\n[${String(img.type).toUpperCase()} VIEW]\n${focus}\nClassify this image independently before combining views.`,
    });
    parts.push(imagePart);
  }

  parts.push({
    text: `\nAfter reviewing all views above, fill observations from the PHOTO EVIDENCE only, then set aiPredictedStage to match those observations. Set aiConfidence from image clarity and how unambiguous the stage features are.`,
  });

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

    const modelConfidence = typeof parsed.aiConfidence === "number" ? parsed.aiConfidence : 0.85;
    const normalizedSelfReported = normalizeStageForGender(selfReportedStage, userGender);

    // Stage from images only — quiz self-report is not an input to reconciliation
    const aiPredictedStage = reconcileStage(
      rawAiStage,
      ruleBasedStage,
      userGender,
      observations,
      modelConfidence
    );

    const confidence = calibrateConfidence({
      modelConfidence,
      imageQuality: parsed.imageQuality,
      gender: userGender,
      observations,
      aiStage: rawAiStage,
      ruleStage: ruleBasedStage,
      finalStage: aiPredictedStage,
      imageCount,
    });

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
      modelConfidence,
      imageQuality: parsed.imageQuality || null,
      imageBased: true,
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
      modelConfidence,
      calibratedConfidence: confidence,
      imageQuality: parsed.imageQuality || null,
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