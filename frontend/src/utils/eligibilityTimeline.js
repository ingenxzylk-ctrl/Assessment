/**
 * Money Back Eligibility Period — maps quiz + AI stage to "Start Seeing Results In" timeline.
 * Source: Zylk eligibility criteria tables (male & female).
 */

const formatMonths = (months) => `${months} Month${months === 1 ? "" : "s"}`;

/** ageRange: "18-25" | "26-35" | "36-45" | "46+" */
export const isUnder35 = (ageRange) => ["18-25", "26-35"].includes(ageRange);

export const isOver35 = (ageRange) => ["36-45", "46+"].includes(ageRange);

export const isUnderOrEqual50 = (ageRange) => ["18-25", "26-35", "36-45"].includes(ageRange);

export const isOver50 = (ageRange) => ageRange === "46+";

/** Convert typed numeric age → legacy ageRange buckets used by eligibility tables */
export function ageToRange(age) {
  const n = Number(age);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n <= 25) return "18-25";
  if (n <= 35) return "26-35";
  if (n <= 45) return "36-45";
  return "46+";
}

/** Prefer typed age; fall back to stored ageRange */
export function resolveAgeRange(aboutMe = {}) {
  if (aboutMe.age !== undefined && aboutMe.age !== null && String(aboutMe.age).trim() !== "") {
    const derived = ageToRange(aboutMe.age);
    if (derived) return derived;
  }
  return aboutMe.ageRange || "";
}

export const hasHeavyDandruff = (hairHealth = {}) =>
  hairHealth.dandruff_experience === "frequent";

export const hasHeavyHairFall = (hairHealth = {}) => {
  const heavyDaily = ["100_150", "over_150", "much_more", "clumps"].includes(
    hairHealth.daily_loss_amount
  );
  const heavyShedding = ["heavy", "clumps", "much_more"].includes(
    String(hairHealth.shedding_amount || "").toLowerCase()
  );
  return heavyDaily || heavyShedding;
};

export const hasFemaleSpecialCondition = (state = {}) => {
  const hair = state.hairHealth || {};
  const internal = state.internalHealth || {};
  const symptoms = internal.symptoms || [];
  const dump = JSON.stringify(state).toLowerCase();

  const anaemia =
    String(internal.iron_level || "").toLowerCase().includes("low iron") ||
    dump.includes("anaemia") ||
    dump.includes("anemia");

  const heavyDandruff = hasHeavyDandruff(hair);

  const pcos =
    symptoms.some((s) => /pcos|pcod/i.test(s)) || dump.includes("pcos");

  const thyroid =
    symptoms.some((s) => /thyroid/i.test(s)) ||
    (internal.health_conditions || []).some((c) => /thyroid/i.test(c)) ||
    dump.includes("thyroid");

  const menopause =
    String(internal.life_stage || "").toLowerCase().includes("don't get my periods") ||
    dump.includes("menopause");

  return anaemia || heavyDandruff || pcos || thyroid || menopause;
};

const maleNorwoodStage = (aiStage, hairHealth = {}) => {
  const stage = String(aiStage || hairHealth.norwood_stage || "").toLowerCase();
  const num = parseInt(stage, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= 7) return num;
  if (stage === "overall-thinning") return "overall-thinning";
  return null;
};

const femaleWideningCategory = (aiStage, hairHealth = {}) => {
  // Prefer photo-based AI stage; fall back to quiz self-report only if AI missing
  const ai = String(aiStage || "").toLowerCase();
  const zone = String(hairHealth.hair_fall_zone || "").toLowerCase();
  const stage = ai || zone;

  if (stage === "overall-thinning") return "hair-thinning";
  if (stage === "patchy-bald") return "coin-patches";
  if (stage === "1" || stage === "2") return "medium-widening";
  if (stage === "3") return "advanced-widening";

  return "medium-widening";
};

/**
 * @returns {{ label: string, months: number|null, eligible: boolean, needsTransplant?: boolean, reason?: string }}
 */
export function getEligibilityTimeline(state, aiPredictedStage) {
  const gender = state?.aboutMe?.gender || "male";
  const ageRange = resolveAgeRange(state?.aboutMe) || "26-35";
  const hairHealth = state?.hairHealth || {};

  if (gender === "female") {
    const category = femaleWideningCategory(aiPredictedStage, hairHealth);

    if (category === "hair-thinning") {
      return {
        label: "Not eligible",
        months: null,
        eligible: false,
        reason: "Hair thinning profile is not covered under the money-back eligibility program.",
      };
    }

    if (category === "coin-patches") {
      return {
        label: formatMonths(8),
        months: 8,
        eligible: true,
        reason: "Coin size patches",
      };
    }

    const hasSpecial = hasFemaleSpecialCondition(state);

    if (category === "medium-widening") {
      const months = hasSpecial ? 8 : 5;
      return {
        label: formatMonths(months),
        months,
        eligible: true,
        reason: hasSpecial
          ? "Medium widening with anaemia, dandruff, PCOS, thyroid, or menopause"
          : "Medium widening",
      };
    }

    if (isOver50(ageRange)) {
      const months = hasSpecial ? 12 : 8;
      return {
        label: formatMonths(months),
        months,
        eligible: true,
        reason: hasSpecial
          ? "Advanced widening (50+) with health conditions"
          : "Advanced widening (50+)",
      };
    }

    const months = hasSpecial ? 8 : 5;
    return {
      label: formatMonths(months),
      months,
      eligible: true,
      reason: hasSpecial
        ? "Advanced widening (≤50) with health conditions"
        : "Advanced widening (≤50)",
    };
  }

  // ——— Male ———
  const ai = String(aiPredictedStage || "").toLowerCase();

  if (ai === "patchy-bald") {
    return {
      label: formatMonths(8),
      months: 8,
      eligible: true,
      reason: "Coin size patches",
    };
  }

  const stage = maleNorwoodStage(aiPredictedStage, hairHealth);
  const heavyDandruff = hasHeavyDandruff(hairHealth);
  const heavyFall = hasHeavyHairFall(hairHealth);
  const under35 = isUnder35(ageRange);
  const over35 = isOver35(ageRange);

  if (typeof stage === "number" && stage >= 1 && stage <= 7) {
    if (stage >= 1 && stage <= 3) {
      if (under35 && !heavyDandruff) {
        return { label: formatMonths(5), months: 5, eligible: true, reason: "Stage 1–3, under 35" };
      }
      return {
        label: formatMonths(8),
        months: 8,
        eligible: true,
        reason: under35 ? "Stage 1–3, under 35, heavy dandruff" : "Stage 1–3, over 35",
      };
    }

    // ✅ FIX: Stages 6–7 → hair transplant, NOT 12 months
    if (stage === 6 || stage === 7) {
      return {
        label: "You Need a Hair Transplant",
        months: null,
        eligible: false,
        needsTransplant: true,
        reason:
          "At Norwood Stage " +
          stage +
          ", follicular depletion is too advanced for topical regrowth alone. Consult a hair transplant specialist for the best outcome.",
      };
    }

    // Stages 4–5 only
    if (under35 && !heavyDandruff) {
      return { label: formatMonths(8), months: 8, eligible: true, reason: "Stage 4–5, under 35" };
    }
    return {
      label: formatMonths(12),
      months: 12,
      eligible: true,
      reason: over35 ? "Stage 4–5, over 35" : "Stage 4–5, under 35, heavy dandruff",
    };
  }

  if (heavyFall || stage === "overall-thinning") {
    const months = heavyFall ? 8 : 5;
    return {
      label: formatMonths(months),
      months,
      eligible: true,
      reason: "Heavy hair fall",
    };
  }

  return { label: formatMonths(6), months: 6, eligible: true, reason: "Default fallback" };
}