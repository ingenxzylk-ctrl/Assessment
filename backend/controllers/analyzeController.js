import { GoogleGenAI } from "@google/genai";
import {
  hasCompleteMaleObservations,
  hasCompleteFemaleObservations,
  hasClearCrownLoss,
  computeMaleNorwoodFromObservations,
  computeFemaleLudwigFromObservations,
  reconcileStage,
  capMaleStageByBridge,
  alignMaleStageDescription,
  normalizeStageForGender,
} from "../utils/norwoodStage.js";

const MODEL_CANDIDATES = [
  ...new Set(
    [
      process.env.GEMINI_MODEL,
       "gemini-3.1-flash-lite"
    ].filter(Boolean)
  ),
];

const GEMINI_RETRIES = Number(process.env.GEMINI_RETRIES) || 2;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Collect primary + optional failover keys from env (deduped, order preserved). */
const getGeminiApiKeys = () => {
  const keys = [
    process.env.GEMINI_API_KEY,
    ...(String(process.env.GEMINI_API_KEYS || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)),
  ].filter(
    (k) => k && k !== "your_key_from_https://aistudio.google.com/apikey"
  );
  return [...new Set(keys)];
};

const errorText = (error) =>
  [
    error?.message,
    error?.status,
    error?.code,
    error?.error?.message,
    typeof error === "string" ? error : "",
    (() => {
      try {
        return JSON.stringify(error);
      } catch {
        return "";
      }
    })(),
  ]
    .filter(Boolean)
    .join(" ");

/**
 * Classify Gemini failures so we do not burn remaining quota with retries/model cascades.
 * - quota: hard daily/project limit — do not retry same key
 * - rate_limit: short burst limit — brief backoff retry OK
 */
const classifyGeminiError = (error) => {
  const msg = errorText(error);
  const lower = msg.toLowerCase();
  const code = Number(error?.status || error?.code) || null;

  if (
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("permission_denied") ||
    code === 401 ||
    code === 403
  ) {
    return {
      type: "auth",
      httpStatus: 401,
      message:
        "Invalid GEMINI_API_KEY. Get a new key from https://aistudio.google.com/apikey and add it to backend/.env",
    };
  }

  if (lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("enotfound")) {
    return {
      type: "network",
      httpStatus: 503,
      message:
        "Backend cannot reach Google Gemini API. Check your internet connection and restart the backend server.",
    };
  }

  if (
    lower.includes("not found") ||
    lower.includes("not_found") ||
    lower.includes("is not supported")
  ) {
    return {
      type: "model",
      httpStatus: 502,
      message:
        "Gemini model not available. Set GEMINI_MODEL=gemini-2.5-flash in backend/.env and restart.",
    };
  }

  const quotaHard =
    lower.includes("resource_exhausted") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("quota exceeded") ||
    lower.includes("billing") ||
    lower.includes("insufficient_quota") ||
    (lower.includes("quota") && !lower.includes("rate"));

  if (quotaHard || (code === 429 && lower.includes("quota"))) {
    return {
      type: "quota",
      httpStatus: 429,
      message:
        "Gemini API quota exceeded for this API key. Wait for the free-tier reset, enable billing in Google AI Studio, or add another key as GEMINI_API_KEYS in backend/.env and restart.",
    };
  }

  if (code === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    return {
      type: "rate_limit",
      httpStatus: 429,
      message:
        "Gemini is rate-limiting requests right now. Wait about a minute and try again.",
    };
  }

  if (code === 503 || lower.includes("unavailable") || lower.includes("timed out") || lower.includes("econnreset")) {
    return {
      type: "transient",
      httpStatus: 503,
      message: "Gemini is temporarily unavailable. Please try again in a moment.",
    };
  }

  return {
    type: "unknown",
    httpStatus: 500,
    message: String(error?.message || error || "Diagnostics failed."),
  };
};

const isRetryable = (err) => {
  const kind = classifyGeminiError(err).type;
  // Never retry hard quota / auth — retries only worsen free-tier exhaustion
  return kind === "rate_limit" || kind === "transient";
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

/** Print Gemini token usage to the backend terminal. */
const logGeminiTokenUsage = (response, { model, label = "request" } = {}) => {
  const usage = response?.usageMetadata;
  if (!usage) {
    console.log(`[Gemini tokens] ${label} model=${model || "?"} — usageMetadata not returned`);
    return;
  }

  const prompt = usage.promptTokenCount ?? 0;
  const output = usage.candidatesTokenCount ?? 0;
  const thoughts = usage.thoughtsTokenCount ?? 0;
  const cached = usage.cachedContentTokenCount ?? 0;
  const total = usage.totalTokenCount ?? prompt + output + thoughts;

  console.log(
    `[Gemini tokens] ${label} model=${model || "?"} | prompt=${prompt} output=${output}` +
      (thoughts ? ` thoughts=${thoughts}` : "") +
      (cached ? ` cached=${cached}` : "") +
      ` total=${total}`
  );
};

const callGemini = async (ai, model, payload, retries = GEMINI_RETRIES) => {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({ ...payload, model });
      logGeminiTokenUsage(response, { model, label: "generateContent" });
      return response;
    } catch (err) {
      lastError = err;
      const kind = classifyGeminiError(err).type;
      console.error(
        `Gemini call failed (model=${model}, attempt=${attempt + 1}, kind=${kind}):`,
        err?.message || err
      );
      if (!isRetryable(err) || attempt === retries - 1) throw err;
      // Longer backoff for rate limits so free-tier RPM recovers
      await delay(kind === "rate_limit" ? 4000 * (attempt + 1) : 2000 * (attempt + 1));
    }
  }
  throw lastError;
};

/**
 * Try models, then failover API keys.
 * On hard quota/auth for a key, skip remaining models for that key and move to the next key.
 */
const callGeminiWithFallback = async (payload) => {
  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    const err = new Error(
      "GEMINI_API_KEY is missing or still a placeholder. Add your real key to backend/.env and restart the server."
    );
    err.status = 401;
    throw err;
  }

  let lastError;
  for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
    const apiKey = apiKeys[keyIndex];
    const ai = new GoogleGenAI({ apiKey });
    const keyLabel = `key#${keyIndex + 1}`;

    for (const model of MODEL_CANDIDATES) {
      try {
        console.log(`Trying Gemini model: ${model} (${keyLabel})`);
        const response = await callGemini(ai, model, payload);
        return { response, model, ai, apiKeyIndex: keyIndex };
      } catch (err) {
        lastError = err;
        const kind = classifyGeminiError(err).type;

        // Hard quota/auth on this key → do not burn more models on the same key
        if (kind === "quota" || kind === "auth") {
          console.warn(
            `Gemini ${kind} on ${keyLabel}; ${
              keyIndex < apiKeys.length - 1 ? "trying next API key..." : "no more keys."
            }`
          );
          break;
        }

        // Model unavailable → try next model on same key
        if (kind === "model") continue;
      }
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
    return `=== FEMALE (LUDWIG) — v9 ===
 
You are an expert trichologist classifying female pattern hair loss (Ludwig scale) from scalp photos.
 
RULES:
- Ground truth = pixels only. Ignore quiz text, filenames, charts.
- Fill observations first, then derive aiPredictedStage from them.
- Blurry/dark/angled/occluded → prefer lower stage.
 
VIEWS: front(part width, frontal density) → side(temple density) → back(crown density, diffuse/patchy)
 
LUDWIG MAP:
1=normal part, full crown | 2=widened part OR reduced crown | 3=very_wide part OR sparse crown/frontal
patchy→"patchy-bald" | diffuse, no clear part pattern→"overall-thinning"
 
HARD RULES (first match wins):
- very_wide OR sparse → min "3" (or patchy-bald if patches)
- widened OR reduced → min "2"
- never "1" if any field shows widened/very_wide/reduced/sparse/patchy
 
WORKED EXAMPLES (boundary calibration):
- part=widened, crown=full, temple=full → "2" (part alone triggers 2, nothing pushes to 3)
- part=normal, crown=reduced, temple=reduced → "2" (crown/temple reduced, part still normal — 2 not 3)
- part=very_wide, crown=reduced → "3" (very_wide alone is sufficient for 3, regardless of crown)
- part=widened, crown=sparse → "3" (sparse crown overrides widened-only-2)
 
SELF-CHECK (do silently before output): re-read your observations object. Does aiPredictedStage match every HARD RULE above given those exact field values? If not, correct aiPredictedStage before writing final JSON.
 
CONFIDENCE: 0.90-0.98 sharp+clear all views | 0.75-0.89 minor blur, stage ±1 clear | 0.55-0.74 one view poor/borderline | <0.55 heavy occlusion/bad angle
 
  REJECT (imageRejected=true) if: not a real scalp photo, blurry, dark/backlit, hat/covering.
On reject: imageQuality="poor", list qualityChecks + rejectionReasons, error="Please upload a clear, well-lit scalp photo with no hats or coverings."
 
Output ONE raw JSON, no markdown/fences:
{"valid":true,"imageRejected":false,"error":"","rejectionReasons":[],
"qualityChecks":{"unclear":false,"insufficientLight":false,"hatOrCovering":false,"filtersApplied":false,"wetHair":false},
"observations":{"frontView":{"partLineWidth":"normal|widened|very_wide","frontalDensity":"full|reduced|sparse"},
"sideView":{"templeDensity":"full|reduced|sparse","notes":""},
"backView":{"crownDensity":"full|reduced|sparse","pattern":"diffuse|patchy|normal"}},
"aiPredictedStage":"1|2|3|overall-thinning|patchy-bald","aiConfidence":0.0,"imageQuality":"good|fair|poor",
"aiReasoning":"name the exact field value(s) and HARD RULE that set the stage","stageDescription":"","finalStage":"","requiresDoctorConsultation":false}
 `;
  }

  return `
=== MALE (NORWOOD) — v9 ===
 
You are an expert trichologist classifying male pattern hair loss (Norwood scale) from scalp photos.
 
RULES:
- Ground truth = pixels only. Ignore quiz text/filenames/charts.
- Fill observations first, then derive aiPredictedStage from them.
- Never infer crown baldness from a front-only photo. Never infer temple recession from lighting/shadow alone.
- Missing/unclear view → prefer lower stage.
 
VIEWS: front(L/R temple recession, hairline shape) → top(crown baldness, scalp extent) → bridge(mid-scalp: full/thinning/absent/not_visible)
 
NORWOOD MAP:
1=full hairline, full crown
2=temples mild only, crown full, bridge full
3=deep bilateral M (temples full) OR early vertex/center thinning w/ mild temples (3V)
4=temples + crown/center thinning together, OR clear crown/vertex loss alone
5=large front+crown bald areas, thin bridge remaining
6=bridge essentially gone, horseshoe forming
7=narrow side/back band only, top fully bald
overall-thinning=diffuse, no classic pattern
 
DECISION TABLE (apply top-down, first match wins):
1. bridge=absent → 6 (or 7 if visibleScalp=extensive AND crown=severe AND temples=severe). A thinning (not absent) bridge is NEVER 6 or 7 — even if scalp is extensive and hairline is receding_severe.
2. crownThinning=severe AND temples≥moderate AND bridge thinning → stage 5 (not 6/7)
3. crown=mild/moderate with visible center/vertex scalp, temples none/mild → 3 or 4 (NEVER 2)
4. crownThinning=mild AND temples=not_visible → min 3 (don't invent stage 2 from missing data)
5. temples not_visible AND crown assessable → stage from crown/top evidence only, never default to 2
6. temples moderate one-side only, OR hairline=receding_mild/moderate, crown=full → 2 (not 3)
7. crown=none/mild AND visibleScalp=minimal AND temples none/mild-single-side → max 2
8. temples=deep bilateral M (both sides) AND crown=full → 3
9. bridge unclear → set "not_visible", never invent bridge loss
10. ambiguous 2 vs 3 with crown fully full and only ONE temple affected → output 2
11. same photo reused across labeled views → note in aiReasoning, lower aiConfidence
 
WORKED EXAMPLES (the boundaries that most often get misjudged):
- templeL=mild, templeR=none, crown=none, bridge=full → "2" (rule 6/7: single mild side, crown full)
- templeL=moderate, templeR=moderate, crown=none, bridge=full → "3" (rule 8: bilateral, deep enough, crown still full)
- templeL=none, templeR=none, crown=mild, visibleScalp=partial, bridge=full → "3" (rule 3: crown/vertex visible even with temples untouched — NEVER stays at 2)
- templeL=mild, templeR=mild, crown=mild, visibleScalp=partial → "4" (rule 3 extended: temples AND crown both present, even if each alone looks mild)
- templeL=not_visible, templeR=not_visible, crown=mild, visibleScalp=partial → "3" (rule 4: missing temple data + mild crown → floor of 3, not 2)
- templeL=severe, templeR=severe, crown=severe, bridge=thinning → "5" (rule 2: severe crown + moderate+ temples + thinning bridge)
- templeL=severe, templeR=severe, crown=severe, bridge=absent → "6" (rule 1: bridge gone is 6, NEVER 5)
- visibleScalp=extensive, crown=severe, bridge=absent → "6" or "7" (rule 1: horseshoe / near-total top — NEVER collapse to 5)
 
SELF-CHECK (do silently before output): re-read your observations object field-by-field against the DECISION TABLE in order. Confirm the first rule that matches your exact field values, and set aiPredictedStage to that rule's output — not a stage you assumed before checking. If your initial guess disagrees with the table, the table wins. Note which rule number applied in aiReasoning.
 
CONFIDENCE: 0.90-0.98 front+crown sharp, bridge assessable | 0.75-0.89 minor blur/angle, stage ±1 clear | 0.55-0.74 missing crown/bridge view or borderline | <0.55 heavy occlusion/extreme angle
 
REJECT (imageRejected=true) if: not a real scalp photo, blurry, dark/backlit, hat/covering.
On reject: imageQuality="poor", list qualityChecks + rejectionReasons, error="Please upload a clear, well-lit scalp photo with no hats or coverings."
 
Output ONE raw JSON, no markdown/fences:
{"valid":true,"imageRejected":false,"error":"","rejectionReasons":[],
"qualityChecks":{"unclear":false,"insufficientLight":false,"hatOrCovering":false,"filtersApplied":false,"wetHair":false},
"observations":{"frontView":{"templeRecessionLeft":"none|mild|moderate|severe","templeRecessionRight":"none|mild|moderate|severe","frontalHairline":"intact|receding_mild|receding_moderate|receding_severe"},
"topView":{"crownThinning":"none|mild|moderate|severe","visibleScalp":"minimal|partial|extensive"},
"midscalpBridge":"full|thinning|absent|not_visible"},
"aiPredictedStage":"1|2|3|4|5|6|7|overall-thinning","aiConfidence":0.0,"imageQuality":"good|fair|poor",
"aiReasoning":"name the exact field value(s) and DECISION TABLE rule number that set the stage","stageDescription":"","finalStage":"","requiresDoctorConsultation":false}`;
};

/** Human-readable labels for AI photo rejection criteria (PDF + API). */
const PHOTO_QUALITY_CRITERIA = {
  unclear: "Image unclear / blurry",
  insufficientLight: "Insufficient lighting / too dark",
  hatOrCovering: "Hat or head covering blocking scalp",
  filtersApplied: "Filters or beauty effects applied",
  wetHair: "Wet hair hiding density",
};

function normalizeQualityChecks(raw = {}) {
  const checks = {};
  for (const key of Object.keys(PHOTO_QUALITY_CRITERIA)) {
    checks[key] = Boolean(raw?.[key]);
  }
  return checks;
}

function collectRejectionReasons(parsed = {}) {
  const fromArray = Array.isArray(parsed.rejectionReasons)
    ? parsed.rejectionReasons.map((r) => String(r || "").trim()).filter(Boolean)
    : [];
  const checks = normalizeQualityChecks(parsed.qualityChecks);
  // Only include lighting and hat/covering as rejection reasons (other tips remain UI-only)
  const blockingKeys = ["insufficientLight", "hatOrCovering"];
  const fromFlags = Object.entries(checks)
    .filter(([key, failed]) => failed && blockingKeys.includes(key))
    .map(([key]) => PHOTO_QUALITY_CRITERIA[key]);

  const merged = [...fromArray];
  for (const label of fromFlags) {
    if (!merged.some((r) => String(r).toLowerCase() === label.toLowerCase())) {
      merged.push(label);
    }
  }
  return { rejectionReasons: merged, qualityChecks: checks };
}

function buildPhotoQualityAssessment(parsed = {}) {
  const { rejectionReasons, qualityChecks } = collectRejectionReasons(parsed);
  const allFailedKeys = Object.entries(qualityChecks)
    .filter(([, failed]) => failed)
    .map(([key]) => key);
  // Only consider these keys as blocking failures for rejection
  const blockingKeys = ["insufficientLight", "hatOrCovering"];
  const failedBlockingKeys = allFailedKeys.filter((k) => blockingKeys.includes(k));
  const imageQuality = String(parsed.imageQuality || "").toLowerCase() || null;
  const rejected = parsed.valid === false || failedBlockingKeys.length > 0 || imageQuality === "poor";

  return {
    rejected,
    imageQuality,
    qualityChecks,
    // Report failed/passed only for blocking criteria to match frontend behavior
    failedCriteria: failedBlockingKeys.map((key) => ({
      key,
      label: PHOTO_QUALITY_CRITERIA[key],
      status: "rejected",
    })),
    passedCriteria: Object.keys(PHOTO_QUALITY_CRITERIA)
      .filter((key) => !failedBlockingKeys.includes(key))
      .map((key) => ({
        key,
        label: PHOTO_QUALITY_CRITERIA[key],
        status: "passed",
      })),
    rejectionReasons,
    note: rejected
      ? "One or more scalp photos were rejected for AI processing because they did not meet image-quality criteria. Clear, well-lit photos without hats or coverings are required for reliable AI analysis."
      : "Uploaded scalp photos met AI processing quality criteria.",
  };
}

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

/** Fingerprint uploaded photos so we can flag the same image reused across slots. */
function fingerprintDataUrl(dataUrl) {
  const s = String(dataUrl || "");
  if (!s) return "";
  const mid = Math.floor(s.length / 2);
  return `${s.length}:${s.slice(22, 86)}:${s.slice(mid, mid + 64)}:${s.slice(-48)}`;
}

function detectDuplicateLabeledImages(labeledImages = []) {
  const present = (Array.isArray(labeledImages) ? labeledImages : []).filter((img) =>
    Boolean(img?.dataUrl)
  );
  if (present.length < 2) {
    return { duplicateImagesDetected: false, duplicateImagesWarning: null, duplicatePairs: [] };
  }

  const prints = present.map((img) => ({
    type: String(img.type || img.label || "photo"),
    print: fingerprintDataUrl(img.dataUrl),
  }));

  const pairs = [];
  for (let i = 0; i < prints.length; i += 1) {
    for (let j = i + 1; j < prints.length; j += 1) {
      if (prints[i].print && prints[i].print === prints[j].print) {
        pairs.push([prints[i].type, prints[j].type]);
      }
    }
  }

  if (!pairs.length) {
    return { duplicateImagesDetected: false, duplicateImagesWarning: null, duplicatePairs: [] };
  }

  const pairText = pairs.map(([a, b]) => `${a} & ${b}`).join(", ");

  return {
    duplicateImagesDetected: true,
    duplicatePairs: pairs,
    duplicateImagesWarning: `The same photo was uploaded for multiple angles (${pairText}). This may affect the AI result — please upload a distinct photo for each view for a more accurate assessment.`,
  };
}

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
    text: `\nAfter reviewing all views above, fill observations from the PHOTO EVIDENCE only, then set aiPredictedStage to match those observations. Set aiConfidence from image clarity and how unambiguous the stage features are. If two labeled views are the same photo, say so in aiReasoning, mark missing angles as not_visible, and do not invent a full hairline assessment.`,
  });

  return parts;
};

export const analyzeScalp = async (req, res) => {
  try {
    const apiKeys = getGeminiApiKeys();
    if (apiKeys.length === 0) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is missing or still a placeholder. Add your real key to backend/.env and restart the server.",
        code: "missing_api_key",
        aiPredictedStage: null,
        analysisComplete: false,
      });
    }

    const { gender, selfReportedStage, images } = req.body;
    const userGender = String(gender || "male").toLowerCase();

    const labeledImages = parseLabeledImages(images);
    const duplicateInfo = detectDuplicateLabeledImages(labeledImages);

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

    console.log(`Analyzing ${imageCount} image(s) with Gemini (${apiKeys.length} API key(s) configured)...`);
    const startTime = Date.now();

    const { response, model, ai } = await callGeminiWithFallback({
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

    const photoQuality = buildPhotoQualityAssessment(parsed);
    const checks = photoQuality.qualityChecks || {};
    const criticalQualityFail =
      Boolean(checks.insufficientLight) ||
      Boolean(checks.hatOrCovering) ||
      String(parsed.imageQuality || "").toLowerCase() === "poor";

    if (parsed.valid === false || criticalQualityFail) {
      let reasons = [...(photoQuality.rejectionReasons || [])];
      if (!reasons.length && String(parsed.imageQuality || "").toLowerCase() === "poor") {
        reasons = ["Image unclear / blurry", "Insufficient lighting / too dark"];
      }
      return res.status(422).json({
        error:
          parsed.error ||
          parsed.reason ||
          (reasons.length
            ? `Please upload a proper image. Rejected: ${reasons.join("; ")}`
            : "Please upload a proper image: clear photos with good lighting and no hats or coverings."),
        imageRejected: true,
        rejectionReasons: reasons,
        qualityChecks: checks,
        photoQualityAssessment: { ...photoQuality, rejected: true, rejectionReasons: reasons },
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
    const reconciledStage = reconcileStage(
      rawAiStage,
      ruleBasedStage,
      userGender,
      observations,
      modelConfidence
    );
    const aiPredictedStage =
      userGender === "male"
        ? capMaleStageByBridge(reconciledStage, observations)
        : reconciledStage;

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

    const calibratedConfidence = duplicateInfo.duplicateImagesDetected
      ? Math.round(Math.max(0.4, confidence - 0.12) * 100) / 100
      : confidence;

    const stageNum = parseInt(aiPredictedStage, 10);
    // Male 6/7 and female patchy only — do not let the model hide kits for Stage 5
    const requiresDoctor =
      (userGender === "male" && !Number.isNaN(stageNum) && stageNum >= 6) ||
      (userGender === "female" && aiPredictedStage === "patchy-bald");

    const photoQualityAssessment = buildPhotoQualityAssessment(parsed);

    const result = {
      finalStage:
        userGender === "male" && /^[1-7]$/.test(String(aiPredictedStage))
          ? `Norwood Stage ${aiPredictedStage}`
          : parsed.finalStage || `Norwood Stage ${aiPredictedStage}`,
      stageDescription:
        userGender === "male"
          ? alignMaleStageDescription(parsed.stageDescription, aiPredictedStage)
          : parsed.stageDescription || "",
      aiPredictedStage,
      rawAiStage: rawAiStage || null,
      ruleBasedStage: ruleBasedStage || null,
      observations,
      stageAdjusted: rawAiStage && aiPredictedStage !== rawAiStage,
      aiConfidence: calibratedConfidence,
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
      qualityChecks: photoQualityAssessment.qualityChecks,
      rejectionReasons: photoQualityAssessment.rejectionReasons,
      photoQualityAssessment,
      photoQualityRejected: photoQualityAssessment.rejected,
      duplicateImagesDetected: duplicateInfo.duplicateImagesDetected,
      duplicateImagesWarning: duplicateInfo.duplicateImagesWarning,
      duplicatePairs: duplicateInfo.duplicatePairs,
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
    const classified = classifyGeminiError(error);
    return res.status(classified.httpStatus).json({
      error: classified.message,
      code: classified.type,
      quotaExceeded: classified.type === "quota",
      rateLimited: classified.type === "rate_limit",
      aiPredictedStage: null,
      analysisComplete: false,
    });
  }
};

