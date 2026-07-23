export const NORWOOD_STAGES = [
  { id: "1", label: "Stage 1", desc: "Minimal to no hairline recession or thinning." },
  { id: "2", label: "Stage 2", desc: "Minor recession around the temples, forming a shallow M-shape." },
  { id: "3", label: "Stage 3", desc: "Deepening temporal recession; first clinically visible signs of baldness." },
  { id: "4", label: "Stage 4", desc: "Severe recession at temples along with sparse hair/baldness on the crown." },
  { id: "5", label: "Stage 5", desc: "The bridge dividing the front recession and crown vertex becomes very thin." },
  { id: "6", label: "Stage 6", desc: "The hair bridge between the front and crown is completely gone, leaving a single bald zone." },
  { id: "7", label: "Stage 7", desc: "Severe loss; only a narrow horseshoe-shaped band of hair remains on sides and back." },
  {
    id: "overall-thinning",
    label: "Overall thinning",
    desc: "Diffuse thinning across the scalp without a classic patterned bald spot.",
  },
];

/** Hair location — PDF Question 2 */
export const HAIR_FALL_LOCATION = [
  { id: "front", label: "Front hairline or temples", img: "/zones/front_hairline.png", layout: "card" },
  { id: "crown", label: "Crown or top of head", img: "/zones/crown_vertex.png", layout: "card" },
  { id: "parting", label: "Both front and crown", img: "/zones/both.png", layout: "card" },
  { id: "all_over", label: "General thinning all over", img: "/zones/general_thinning.png", layout: "card" },
];

/** Shedding — PDF Question 3 (replaces strand-count options) */
export const SHEDDING_OPTIONS = [
  { id: "same", label: "About the same as usual" },
  { id: "slightly_more", label: "Slightly more than usual" },
  { id: "much_more", label: "Much more than usual" },
  { id: "clumps", label: "Hair is coming out in noticeable clumps" },
  
];

/** Dandruff — drives product recommendation (frequent | moderate | no) */
export const DANDRUFF_QUESTION_OPTIONS = [
  { id: "frequent", label: "Heavy dandruff" },
  { id: "moderate", label: "Mild dandruff" },
  { id: "no", label: "No dandruff" },
];

/** Scalp symptoms — multi-select (Hair section; required before Next) */
export const SCALP_SYMPTOM_OPTIONS = [
  { id: "flaking", label: "Flaking or dandruff" },
  { id: "itching", label: "Itching" },
  { id: "redness", label: "Redness or irritation" },
  { id: "oily", label: "Oily scalp" },
  { id: "tenderness", label: "Tenderness or burning" },
  { id: "none", label: "None of these" },
];

/** Derive legacy dandruff_experience from scalp symptom multi-select */
export function deriveDandruffExperience(scalpSymptoms = []) {
  const list = Array.isArray(scalpSymptoms) ? scalpSymptoms : [];
  if (!list.length || list.includes("none")) return "no";
  if (list.includes("flaking")) return "frequent";
  return "moderate";
}

/** Family history — PDF Question 5 */
export const FAMILY_HISTORY = [
  { id: "mother", label: "Mother's side" },
  { id: "father", label: "Father's side" },
  { id: "both", label: "Both sides" },
  { id: "none", label: "No known family history" },
 
];

/** Timeline — PDF Question 6 */
export const LOSS_DURATION_OPTIONS = [
  { id: "under_3m", label: "Within the past 3 months" },
  { id: "3m_6m", label: "3–6 months ago" },
  { id: "6m_1y", label: "6–12 months ago" },
  { id: "1y_3y", label: "1–3 years ago" },
  { id: "over_3y", label: "More than 3 years ago" },
  
];

// Scalp Health Choices (legacy)
export const DANDRUFF_OPTIONS = [
  { id: "severe", label: "Yes, severe or chronic flaking & itching" },
  { id: "mild", label: "Yes, mild or occasional flakes" },
  { id: "none", label: "No dandruff or flaking problems" },
];

// Female Systemic Conditions & Symptoms
export const FEMALE_SYMPTOMS = [
  { id: "periods", label: "Irregular menstrual cycles" },
  { id: "pcos", label: "PCOS / PCOD clinical diagnosis" },
  { id: "fatigue", label: "Extreme or unexplained daytime fatigue" },
  { id: "thyroid", label: "Thyroid hormone imbalances" },
  { id: "none", label: "None of these apply to me" },
];

/** Health section options — PDF Section 3 */
export const HEALTH_SLEEP_OPTIONS = [
  "Under 5 hours",
  "5–6 hours",
  "7–8 hours",
  "More than 8 hours",
  // PDF annotation: "It varies or I'm not sure" struck through — omitted
];

export const HEALTH_STRESS_OPTIONS = [
  "Low or manageable",
  "Moderate",
  "High",
  "Very high or recent major stress",
  // PDF annotation: "Prefer not to say" struck through — omitted
];

export const HEALTH_CONDITION_OPTIONS = [
  "Thyroid condition",
  "Diabetes",
  "Iron deficiency or anemia",
  "Autoimmune condition",
  "None of these or not sure",
  "Other",
];

export const HEALTH_DIGESTIVE_OPTIONS = [
  "No ongoing symptoms",
  "Occasional bloating, reflux, diarrhea, or constipation",
  "Frequent symptoms",
  "Diagnosed digestive condition",
  
];

export const HEALTH_DIET_WEIGHT_OPTIONS = [
  "No major change",
  "Lost weight intentionally",
  "Lost weight unexpectedly",
  "Gained weight",
  "Started a restrictive diet or fasting",
  
];

export const HEALTH_ENERGY_OPTIONS = [
  "Steady most of the day",
  "Afternoon dip",
  "Low most of the day",
  "It varies a lot",
  
];

export const HEALTH_SUPPLEMENT_OPTIONS = ["Yes", "No"];

export const HEALTH_PRESCRIPTION_OPTIONS = ["Yes", "No"];

/** Food habits — male + female health */
export const HEALTH_FOOD_HABITS_OPTIONS = ["Vegetarian", "Non-Vegetarian"];

/** True when Yes/No answered; if Yes, detail text is required. */
export function isYesNoWithDetailsAnswered(choice, details) {
  const c = String(choice || "").trim().toLowerCase();
  if (c === "no") return true;
  if (c === "yes") return Boolean(String(details || "").trim());
  return false;
}

/** Format for PDF / Result: "No" or "Yes — biotin, iron". */
export function formatYesNoWithDetails(choice, details) {
  const c = String(choice || "").trim();
  if (!c) return null;
  if (c.toLowerCase() === "no") return "No";
  if (c.toLowerCase() === "yes") {
    const d = String(details || "").trim();
    return d ? `Yes — ${d}` : "Yes";
  }
  return c;
}
