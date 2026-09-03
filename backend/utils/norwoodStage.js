/**
 * Image-first Norwood / Ludwig staging from photo observations.
 * Used by analyzeController and unit tests (must not import Gemini).
 */

const SEVERITY = { none: 0, mild: 1, moderate: 2, severe: 3 };


const level = (value) => SEVERITY[String(value || "none").toLowerCase()] ?? 0;

const isUnknownObservation = (value) => {
  const s = String(value || "")
    .toLowerCase()
    .trim();
  return (
    !s ||
    s === "not_visible" ||
    s === "unknown" ||
    s === "n/a" ||
    s === "na" ||
    s === "unclear" ||
    s.includes("not visible") ||
    s.includes("not_visible")
  );
};

const maxTempleRecession = (front = {}) =>
  Math.max(
    isUnknownObservation(front.templeRecessionLeft) ? 0 : level(front.templeRecessionLeft),
    isUnknownObservation(front.templeRecessionRight) ? 0 : level(front.templeRecessionRight)
  );

/** True when front temples/hairline can actually be judged from the photos. */
const templesAssessable = (front = {}) => {
  const leftOk = !isUnknownObservation(front.templeRecessionLeft);
  const rightOk = !isUnknownObservation(front.templeRecessionRight);
  const hairlineOk = !isUnknownObservation(front.frontalHairline);
  return leftOk || rightOk || hairlineOk;
};

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

/** Crown/vertex-only staging when the hairline cannot be judged. */
const stageFromCrownOnly = (observations = {}) => {
  const top = observations.topView || {};
  const bridge = String(observations.midscalpBridge || "not_visible").toLowerCase();
  const scalp = String(top.visibleScalp || "minimal").toLowerCase();
  const crown = isUnknownObservation(top.crownThinning) ? 0 : level(top.crownThinning);

  // Stage 7: near-total top loss
  if (bridge === "absent" && scalp === "extensive" && crown >= 3) return "7";
  // Stage 6: bridge gone / horseshoe forming — must not collapse to 5
  if (bridge === "absent" || (scalp === "extensive" && crown >= 2 && bridge !== "full" && bridge !== "thinning")) {
    return "6";
  }
  if (crown >= 3 || scalp === "extensive" || bridge === "thinning") return "5";
  if (crown >= 2 || scalp === "partial") return "4";
  // Any visible crown/center thinning with missing hairline → at least Norwood 3V
  if (crown >= 1) return "3";
  return null;
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
  const crown = isUnknownObservation(top.crownThinning) ? 0 : level(top.crownThinning);
  // Moderate+ crown, visible scalp, or bridge change = clear loss.
  // Mild crown alone is usually noise WHEN temples are assessable — handled by callers.
  return crown >= 2 || scalp === "partial" || scalp === "extensive" || bridge === "thinning" || bridge === "absent";
};

/** Mild crown/center thinning counts when hairline cannot be judged from photos. */
const hasAnyCrownThinning = (observations = {}) => {
  const top = observations.topView || {};
  const crown = isUnknownObservation(top.crownThinning) ? 0 : level(top.crownThinning);
  return crown >= 1 || hasClearCrownLoss(observations);
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
  const front = observations.frontView || {};
  const top = observations.topView || {};
  const bridge = String(observations.midscalpBridge || "not_visible").toLowerCase();
  const scalp = String(top.visibleScalp || "minimal").toLowerCase();
  const crown = isUnknownObservation(top.crownThinning) ? 0 : level(top.crownThinning);
  // Cannot claim "early" if temples aren't visible or crown already shows thinning
  if (!templesAssessable(front)) return false;
  if (crown >= 1) return false;
  return scalp === "minimal" && bridge !== "absent" && bridge !== "thinning";
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

const computeMaleNorwoodFromObservations = (observations = {}) => {
  if (!hasCompleteMaleObservations(observations)) return null;

  const front = observations.frontView || {};
  const top = observations.topView || {};
  const bridge = String(observations.midscalpBridge || "not_visible").toLowerCase();

  const temples = maxTempleRecession(front);
  const crown = isUnknownObservation(top.crownThinning) ? 0 : level(top.crownThinning);
  const scalp = String(top.visibleScalp || "minimal").toLowerCase();
  const canJudgeTemples = templesAssessable(front);

  // Hairline not visible (e.g. duplicate crown photos used for Front + Top) → stage from crown
  if (!canJudgeTemples) {
    return stageFromCrownOnly(observations) || "3";
  }

  // HARD RULE: no clear crown/bridge loss → stage 1–3 from temples only
  // Fixes stage-2 hairlines wrongly labeled 4/5 because crown was marked "mild"
  if (!hasClearCrownLoss(observations) && crown <= 1) {
    // Mild crown WITH assessable temples and full bridge stays temple-only
    return stageFromTemplesOnly(observations);
  }

  // Stage 7: near-total top loss — horseshoe only (bridge must be gone)
  if (bridge === "absent" && scalp === "extensive" && temples >= 3 && crown >= 3) {
    return "7";
  }

  // Stage 6: bridge gone / horseshoe forming. Thinning bridge stays Stage 5.
  if (bridge === "absent") {
    return "6";
  }

  // Stage 5: BOTH significant front AND crown loss
  if (
    temples >= 3 && crown >= 2 && (bridge === "thinning" || scalp === "partial" || scalp === "extensive")
  ) {
    return "5";
  }
  if (temples >= 2 && crown >= 3 && bridge === "thinning") return "5";

  // Crown-dominant / vertex pattern (mild temples + clear center loss) → 4+, not 2/3
  if (temples <= 1 && crown >= 3) return "5";
  if (temples <= 1 && (crown >= 2 || scalp === "partial" || bridge === "thinning")) return "4";
  if (temples <= 1 && crown >= 1 && (scalp === "partial" || bridge === "thinning")) return "4";

  // Stage 4: needs REAL crown thinning (moderate+), not mild noise
  if (temples >= 2 && crown >= 2) return "4";
  if (temples >= 2 && crown >= 2 && scalp === "partial") return "4";

  // Crown mild + temples assessable → still early
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
  // Skip when temples/hairline are not assessable — stage from crown instead.
  if (
    gender === "male" &&
    templesAssessable(observations?.frontView || {}) &&
    !hasClearCrownLoss(observations) &&
    !hasStrongAdvancedEvidence(observations) &&
    !hasAnyCrownThinning(observations)
  ) {
    const templeStage = stageFromTemplesOnly(observations);
    return pickConservativeEarlyStage(templeStage, ai || imagePrimary);
  }

  // Crown-only photos (temples not_visible): never collapse to stage 2 via temple rules
  if (gender === "male" && !templesAssessable(observations?.frontView || {}) && hasAnyCrownThinning(observations)) {
    const crownStage = stageFromCrownOnly(observations) || rule || "3";
    if (ai) {
      const aiNum = parseInt(ai, 10);
      const crownNum = parseInt(crownStage, 10);
      if (!Number.isNaN(aiNum) && !Number.isNaN(crownNum) && aiNum > crownNum && aiNum <= 7) {
        return String(aiNum);
      }
    }
    return crownStage;
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
      if (aiNum >= 6 || ruleNum >= 6) return String(Math.max(aiNum, ruleNum));
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

/** Thinning/full mid-scalp hair means the horseshoe has not formed — Norwood 5 max. */
const capMaleStageByBridge = (stage, observations = {}) => {
  const n = parseInt(stage, 10);
  if (Number.isNaN(n) || n < 6) return stage;
  const bridge = String(observations?.midscalpBridge || "").toLowerCase();
  if (bridge === "thinning" || bridge === "full") return "5";
  return stage;
};

const NORWOOD_STAGE_COPY = {
  5: "Norwood Stage 5: Large areas of baldness at the front and crown, with a thinning bridge of hair remaining between them.",
  6: "Norwood Stage 6: The bridge of hair between the front and crown is gone, leaving a horseshoe pattern.",
  7: "Norwood Stage 7: Only a narrow band of hair remains at the sides and back.",
};

const alignMaleStageDescription = (description, stage) => {
  const n = String(stage || "");
  const fallback = NORWOOD_STAGE_COPY[n] || "";
  const text = String(description || "").trim();
  const mentioned = text.match(/stage\s*(\d)/i);
  if (mentioned && mentioned[1] !== n && fallback) return fallback;
  return text || fallback;
};

const normalizeStageForGender = (stage, gender) =>
  gender === "female" ? normalizeFemaleStage(stage) : normalizeMaleStage(stage);

export {
  computeMaleNorwoodFromObservations,
  computeFemaleLudwigFromObservations,
  reconcileStage,
  capMaleStageByBridge,
  alignMaleStageDescription,
  normalizeStageForGender,
  hasCompleteMaleObservations,
  hasCompleteFemaleObservations,
  hasClearCrownLoss,
};
