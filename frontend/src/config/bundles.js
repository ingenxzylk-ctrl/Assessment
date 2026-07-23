
/**
 * Bundle config — prices from Zylk Health product sheet
 */
export const BUNDLE_CONFIG = {
  1: {
    label: "Bundle 1 — Male Stage 2–5 (No Dandruff)",
    pdfBundle: "Bundle-1",
    wooProductId: 8319,
    wooProductIdNoMix: 8307,
    priceWithMix: 2999,
    priceWithoutMix: 1799,
    originalPrice: 3623,
  },
  2: {
    label: "Bundle 2 — Male Stage 2–5 (Dandruff)",
    pdfBundle: "Bundle-2",
    wooProductId: 8311,
    wooProductIdNoMix: 8323,
    priceWithMix: 2999,
    priceWithoutMix: 1799,
    originalPrice: 3624,
  },
  3: {
    label: "Bundle 5 — Stage 1 / Overall Thinning",
    pdfBundle: "Bundle-5",
    // No dandruff: combined kits (Health Mix baked into the Woo product)
    wooProductId: 8315,
    wooProductIdNoMix: 8325,
    // With dandruff: kit has NO Health Mix — add Health Mix separately when opted in
    wooProductIdWithDandruff: 8393,
    healthMixProductId: 8303,
    priceWithDandruffNoMix: 1026,
    priceWithDandruffWithMix: 2825, // 1026 + 1799 Health Mix
    originalPriceWithDandruff: 1476,
    priceWithMix: 2999,
    priceWithoutMix: 1399,
    originalPrice: 3273,
  },
  4: {
    label: "Bundle 7 — Female Stage 2–3 (No Dandruff)",
    pdfBundle: "Bundle-7",
    wooProductId: 8317,
    wooProductIdNoMix: 8327,
    priceWithMix: 2999,
    priceWithoutMix: 1699,
    originalPrice: 3523,
  },
  // Female stage 2–3 WITH dandruff (separate from Bundle-5 8393/8303 flow)
  5: {
    label: "Female Stage 2–3 (Dandruff)",
    pdfBundle: "Bundle-7-Dandruff",
    // Reuse Bundle-7 Woo IDs until a dedicated female-dandruff SKU is configured
    wooProductId: 8317,
    wooProductIdNoMix: 8327,
    priceWithMix: 2999,
    priceWithoutMix: 1699,
    originalPrice: 3523,
  },
  99: {
    label: "₹1 Test Bundle",
    wooProductId: 8363, // Replace with your real WooCommerce test product ID
    wooProductIdNoMix: 8363,
    priceWithMix: 1,
    priceWithoutMix: 1,
    originalPrice: 1,
  },
};


export const TEST_BUNDLE_NUMBER = 99;
export const HAIR_HEALTH_MIX_ID = "zylk-hair-health-mix";

/** Fallback Health Mix Woo ID (prefer config.healthMixProductId on Bundle 5) */
export const SEPARATE_HEALTH_MIX_WOO_ID = 8303;

/**
 * Stage 1 / overall thinning WITH dandruff → kit 8393 (no Health Mix in the kit).
 * Health Mix is optional via config.healthMixProductId (8303).
 * Without dandruff → 8315 (with mix) / 8325 (without mix).
 */
export function usesSeparateHealthMixProduct(
  bundleNumber,
  hasDandruff = false,
  _gender = null
) {
  if (bundleNumber === 3 && hasDandruff) return true;
  return false;
}

/**
 * Resolve WooCommerce product ID(s) to add at checkout.
 *
 * No dandruff:
 *   includeHealthMix → [8315]
 *   else             → [8325]
 *
 * With dandruff:
 *   always           → [8393]
 *   + includeHealthMix → also [8303]
 *
 * @returns {{ kitId: number|null, mixId: number|null, productIds: number[] }}
 */
export function getCheckoutWooProductIds({
  bundleNumber,
  hasDandruff = false,
  includeHealthMix = true,
  gender = null,
} = {}) {
  const config = BUNDLE_CONFIG[bundleNumber];
  if (!config) return { kitId: null, mixId: null, productIds: [] };

  // Bundle-5 + dandruff: kit 8393, optional separate Health Mix 8303
  if (usesSeparateHealthMixProduct(bundleNumber, hasDandruff, gender)) {
    const kitId = Number(config.wooProductIdWithDandruff) || 8393;
    const mixId = includeHealthMix
      ? Number(config.healthMixProductId) || SEPARATE_HEALTH_MIX_WOO_ID
      : null;
    return {
      kitId,
      mixId,
      productIds: mixId ? [kitId, mixId] : [kitId],
    };
  }

  // All other kits (including Bundle-5 without dandruff): single combined SKU
  const kitId = includeHealthMix
    ? Number(config.wooProductId)
    : Number(config.wooProductIdNoMix ?? config.wooProductId);
  return {
    kitId: kitId || null,
    mixId: null,
    productIds: kitId ? [kitId] : [],
  };
}

/**
 * Unique personalized name for each recommended kit (Zylk product sheet).
 * Bundle 1 / 2 / 5 / 7 → distinct kit names + user stage.
 */
export function getBundleDisplayName(bundleNumber, gender, stage) {
  const stageStr = String(stage ?? "");
  const stageLabel =
    stageStr === "overall-thinning"
      ? "Overall Thinning"
      : /^\d+$/.test(stageStr)
        ? `Stage ${stageStr}`
        : stageStr
          ? stageStr.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          : "";

  if (bundleNumber === 99) return "Zylk ₹1 Test Kit";

  if (bundleNumber === 1) {
    // Bundle-1 — male pattern loss, no dandruff
    return stageLabel
      ? `Zylk Pattern Restore Kit — ${stageLabel} Men`
      : "Zylk Pattern Restore Kit — Men";
  }

  if (bundleNumber === 2 || bundleNumber === 5) {
    // Dandruff / ProGro Scalp-Clear (no dermaroller)
    // Bundle 2 = male Minoxidil 5%; Bundle 5 = female Minoxidil 2%
    const genderLabel = gender === "female" || bundleNumber === 5 ? "Women" : "Men";
    return stageLabel
      ? `Zylk ProGro Scalp-Clear Kit — ${stageLabel} ${genderLabel}`
      : `Zylk ProGro Scalp-Clear Kit — ${genderLabel}`;
  }

  if (bundleNumber === 4) {
    // Bundle-7 — female stage 2–3, no dandruff (includes dermaroller)
    return stageLabel
      ? `Zylk Women's Density Kit — ${stageLabel}`
      : "Zylk Women's Density Kit";
  }

  // Bundle-5 — stage 1 or overall thinning
  if (stageStr === "overall-thinning") {
    return gender === "female"
      ? "Zylk Diffuse Thinning Care Kit — Women"
      : "Zylk Diffuse Thinning Care Kit — Men";
  }

  if (stageLabel) {
    return gender === "female"
      ? `Zylk Early Care Kit — ${stageLabel} Women`
      : `Zylk Early Care Kit — ${stageLabel} Men`;
  }

  return gender === "female" ? "Zylk Early Care Kit — Women" : "Zylk Early Care Kit — Men";
}
/**
 * Resolve kit WooCommerce product ID (primary line item only).
 * Bundle-5 + dandruff → always 8393 (Health Mix is a second line item via healthMixProductId).
 * Bundle-5 without dandruff → 8315 with mix / 8325 without mix.
 */
export function getWooProductId(
  bundleNumber,
  includeHealthMix = true,
  hasDandruff = false,
  gender = null
) {
  const { kitId } = getCheckoutWooProductIds({
    bundleNumber,
    includeHealthMix,
    hasDandruff,
    gender,
  });
  return kitId;
}

/**
 * Separate Health Mix Woo ID when checkbox is on — reads config.healthMixProductId (8303).
 */
export function getSeparateHealthMixWooId(
  bundleNumber,
  includeHealthMix = true,
  hasDandruff = false,
  gender = null
) {
  const { mixId } = getCheckoutWooProductIds({
    bundleNumber,
    includeHealthMix,
    hasDandruff,
    gender,
  });
  return mixId;
}
export function getBundlePrices(bundleNumber, hasDandruff = false, gender = null) {
  const config = BUNDLE_CONFIG[bundleNumber];
  if (!config) return { priceWithMix: 0, priceWithoutMix: 0, originalPrice: 0 };

  // Stage 1 / overall thinning + dandruff → Woo 8393 (+ optional 8303)
  if (usesSeparateHealthMixProduct(bundleNumber, hasDandruff, gender)) {
    return {
      priceWithMix: config.priceWithDandruffWithMix ?? 2825,
      priceWithoutMix: config.priceWithDandruffNoMix ?? 1026,
      originalPrice: config.originalPriceWithDandruff ?? 1476,
    };
  }

  return {
    priceWithMix: config.priceWithMix,
    priceWithoutMix: config.priceWithoutMix,
    originalPrice: config.originalPrice,
  };
}
export function resolveBundleNumber(gender, stage, hasDandruff) {
  const stageStr = String(stage ?? "");
  const isMale = gender === "male";
  const isFemale = gender === "female";

  // Sheet 1 — Bundle-5: stage 1 (any gender) and overall thinning
  if (stageStr === "1" || stageStr === "overall-thinning") return 3;

  // Female stage 2–3:
  // - with dandruff → quiz bundle 5 (antidandruff / ProGro / Minoxidil 2%, no dermaroller)
  // - without dandruff → quiz bundle 4 (Sheet Bundle-7, includes dermaroller)
  if (isFemale && ["2", "3"].includes(stageStr)) {
    return hasDandruff ? 5 : 4;
  }

  // Sheet 1 — male stage 2–5
  if (isMale && ["2", "3", "4", "5"].includes(stageStr)) {
    return hasDandruff ? 2 : 1;
  }

  // Fallback → Bundle-5
  return 3;
}
export function getTestBundle() {
  const config = BUNDLE_CONFIG[TEST_BUNDLE_NUMBER];
  return {
    id: "bundle-test-1rupee",
    bundleId: "bundle-test-1rupee",
    name: config.label,
    price: config.priceWithMix,
    priceWithMix: config.priceWithMix,
    priceWithoutMix: config.priceWithoutMix,
    bundleNumber: TEST_BUNDLE_NUMBER,
    isTestBundle: true,
    wooProductId: config.wooProductId,
    subtitle: "Test checkout flow",
  };
}