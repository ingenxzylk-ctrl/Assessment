/**
 * Zylk Health Product Bundles
 *
 * Bundle 1 — Male stage 2–5, no dandruff
 * Bundle 2 — Male stage 2–5, with dandruff
 * Bundle 3 — Stage 1 (men/female) + overall thinning
 * Bundle 4 — Female stage 2–3
 */

export const HAIR_HEALTH_MIX_ID = "prod-hair-health-mix";

export const HAIR_HEALTH_MIX = {
  id: HAIR_HEALTH_MIX_ID,
  name: "Hair Health Mix",
  subtitle: "Daily supplement blend for root nourishment",
  price: 1200,
  removable: true,
};

const BUNDLE_DEFINITIONS = {
  1: {
    bundleNumber: 1,
    originalPrice: 3999,
    bundlePrice: 2999,
    priceWithoutMix: 1799,
    items: [
      { id: "prod-minox-5", name: "Minoxidil 5%", subtitle: "Topical growth solution", price: 850 },
      { id: "prod-rosemary-oil", name: "Rosemary Oil", subtitle: "Follicle stimulation oil", price: 599 },
      { id: "prod-detox-shampoo", name: "Detox Shampoo", subtitle: "Scalp cleansing shampoo", price: 350 },
      { id: "prod-dermaroller", name: "Dermaroller", subtitle: "0.5mm scalp micro-needling roller", price: 350 },
      { id: "prod-massager", name: "Scalp Massager", subtitle: "Silicone scalp massager brush", price: 250 },
      { id: "prod-tea-tree-conditioner", name: "Tea Tree Conditioner", subtitle: "Scalp soothing conditioner", price: 350 },
      HAIR_HEALTH_MIX,
    ],
  },

  2: {
    bundleNumber: 2,
    originalPrice: 3999,
    bundlePrice: 2999,
    priceWithoutMix: 1799,
    items: [
      { id: "prod-minox-5", name: "Minoxidil 5%", subtitle: "Topical growth solution", price: 850 },
      { id: "prod-progro-oil", name: "ProGro Oil", subtitle: "Anti-dandruff nourishing oil", price: 599 },
      { id: "prod-tea-tree-mist", name: "Tea Tree Mist", subtitle: "Scalp refresh mist", price: 399 },
      { id: "prod-antidandruff-shampoo", name: "Antidandruff Shampoo", subtitle: "Clinical dandruff control shampoo", price: 350 },
      { id: "prod-massager", name: "Scalp Massager", subtitle: "Silicone scalp massager brush", price: 250 },
      HAIR_HEALTH_MIX,
    ],
  },

  3: {
    bundleNumber: 3,
    originalPrice: 3599,
    bundlePrice: 2999,
    priceWithoutMix: 1399,
    items: [
      { id: "prod-rosemary-oil", name: "Rosemary Oil", subtitle: "Natural follicle stimulation oil", price: 599 },
      { id: "prod-rosemary-mist", name: "Rosemary Mist", subtitle: "Lightweight scalp mist", price: 399 },
      { id: "prod-detox-shampoo", name: "Detox Shampoo", subtitle: "Scalp cleansing shampoo", price: 350 },
      { id: "prod-dermaroller", name: "Dermaroller", subtitle: "0.5mm scalp micro-needling roller", price: 350 },
      { id: "prod-massager", name: "Scalp Massager", subtitle: "Silicone scalp massager brush", price: 250 },
      { id: "prod-tea-tree-conditioner", name: "Tea Tree Conditioner", subtitle: "Scalp soothing conditioner", price: 350 },
      HAIR_HEALTH_MIX,
    ],
  },

  4: {
    bundleNumber: 4,
    originalPrice: 3799,
    bundlePrice: 2999,
    priceWithoutMix: 1699,
    items: [
      { id: "prod-minox-2", name: "Minoxidil 2%", subtitle: "Gentle female formula growth solution", price: 750 },
      { id: "prod-rosemary-oil", name: "Rosemary Oil", subtitle: "Follicle stimulation oil", price: 599 },
      { id: "prod-detox-shampoo", name: "Detox Shampoo", subtitle: "Scalp cleansing shampoo", price: 350 },
      { id: "prod-dermaroller", name: "Dermaroller", subtitle: "0.5mm scalp micro-needling roller", price: 350 },
      { id: "prod-massager", name: "Scalp Massager", subtitle: "Silicone scalp massager brush", price: 250 },
      { id: "prod-tea-tree-conditioner", name: "Tea Tree Conditioner", subtitle: "Scalp soothing conditioner", price: 350 },
      HAIR_HEALTH_MIX,
    ],
  },
};

export function getBundleDisplayTitle(bundleNumber, gender, stage) {
  const stageStr = String(stage);
  const isMale = gender === "male";
  const isFemale = gender === "female";

  if (bundleNumber === 3) {
    if (stageStr === "overall-thinning") return "Overall Thinning Product";
    if (isMale) return "Stage 1 Men Product";
    if (isFemale) return "Stage 1 Female Product";
    return "Stage 1 Product";
  }

  if (bundleNumber === 4) return "Stage 2-3 Female Product";
  if (bundleNumber === 1) return "Stage 2-5 Men Product";
  if (bundleNumber === 2) return "Stage 2-5 Men Product (Dandruff)";

  return `Bundle ${bundleNumber} Product`;
}

export function resolveBundleNumber(gender, stage, hasDandruff) {
  const stageStr = String(stage);
  const isMale = gender === "male";
  const isFemale = gender === "female";

  if (isMale && ["6", "7"].includes(stageStr)) return null;
  if (isFemale && stageStr === "patchy-bald") return null;

  if (stageStr === "1" || stageStr === "overall-thinning") return 3;
  if (isFemale && ["2", "3"].includes(stageStr)) return 4;
  if (isMale && ["2", "3", "4", "5"].includes(stageStr)) {
    return hasDandruff ? 2 : 1;
  }

  return null;
}

export function getRecommendedBundle(gender, stage, hasDandruff = false) {
  const bundleNumber = resolveBundleNumber(gender, stage, hasDandruff);
  if (!bundleNumber) return null;

  const def = BUNDLE_DEFINITIONS[bundleNumber];
  const bundleTitle = getBundleDisplayTitle(bundleNumber, gender, stage);

  return {
    bundleNumber,
    bundleId: `zylk-bundle-${bundleNumber}-${gender}-stage-${String(stage)}`,
    bundleTitle,
    originalPrice: def.originalPrice,
    bundlePrice: def.bundlePrice,
    priceWithoutMix: def.priceWithoutMix,
    items: def.items.map((item) => ({ ...item })),
  };
}

export function getBundleWithHealthMix(gender, stage, hasDandruff = false, includeHealthMix = true) {
  const bundle = getRecommendedBundle(gender, stage, hasDandruff);
  if (!bundle) return null;

  if (includeHealthMix) return bundle;

  return {
    ...bundle,
    items: bundle.items.filter((item) => item.id !== HAIR_HEALTH_MIX_ID),
    bundlePrice: bundle.priceWithoutMix,
  };
}

// Backward compatibility
export const getCustomBundle = getRecommendedBundle;