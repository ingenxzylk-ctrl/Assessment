/**
 * Bundle config — Men stage kits + Women Advance kit (single Woo SKUs)
 *
 * Male:
 *   Stage 1 / overall thinning → 8588 (Men Advance) ₹749
 *   Stage 2 → 8594 ₹999
 *   Stage 3 → 8595 ₹1199
 *   Stage 4 → 8596 ₹1199
 *   Stage 5+ → 8597 ₹1299
 * Female (all stages) → 8590 (Women Advance) ₹749
 *
 * Checkout adds ONE product only via same-tab /checkout/?add-to-cart=KIT
 * (never popups, never /cart/?add-to-cart=).
 */
export const BUNDLE_CONFIG = {
  // Male stage 1 / overall thinning — Men Advance Hair Regrowth Kit
  1: {
    label: "Men Advance Hair Regrowth Kit",
    wooProductId: 8588,
    wooProductIdNoMix: 8588,
    priceWithMix: 749,
    priceWithoutMix: 749,
    originalPrice: 1125,
  },
  // Male stage 2
  2: {
    label: "Stage 2 Hair Regrowth Kit",
    wooProductId: 8594,
    wooProductIdNoMix: 8594,
    priceWithMix: 999,
    priceWithoutMix: 999,
    originalPrice: 1296,
  },
  // Male stage 3
  3: {
    label: "Stage 3 Hair Regrowth Kit",
    wooProductId: 8595,
    wooProductIdNoMix: 8595,
    priceWithMix: 1199,
    priceWithoutMix: 1199,
    originalPrice: 1595,
  },
  // Male stage 4
  4: {
    label: "Stage 4 Hair Regrowth Kit",
    wooProductId: 8596,
    wooProductIdNoMix: 8596,
    priceWithMix: 1199,
    priceWithoutMix: 1199,
    originalPrice: 1724,
  },
  // Male stage 5+
  5: {
    label: "Stage 5 Hair Regrowth Kit",
    wooProductId: 8597,
    wooProductIdNoMix: 8597,
    priceWithMix: 1299,
    priceWithoutMix: 1299,
    originalPrice: 1824,
  },
  // Female — all stages
  6: {
    label: "Women Advance Hair Regrowth Kit",
    wooProductId: 8590,
    wooProductIdNoMix: 8590,
    priceWithMix: 749,
    priceWithoutMix: 749,
    originalPrice: 1125,
  },
  99: {
    label: "₹1 Test Bundle",
    wooProductId: 8363,
    wooProductIdNoMix: 8363,
    priceWithMix: 1,
    priceWithoutMix: 1,
    originalPrice: 1,
  },
};

/** Production kit Woo IDs used by checkout allow-list */
export const STAGE_KIT_WOO_IDS = [8588, 8594, 8595, 8596, 8597, 8590];

export const TEST_BUNDLE_NUMBER = 99;
export const HAIR_HEALTH_MIX_ID = "zylk-hair-health-mix";
export const SEPARATE_HEALTH_MIX_WOO_ID = 8303;

/**
 * New kits are single WooCommerce products — no separate Health Mix line item.
 */
export function usesSeparateHealthMixProduct(
  _bundleNumber,
  _hasDandruff = false,
  _gender = null
) {
  return false;
}

/**
 * Resolve WooCommerce product ID(s) to add at checkout.
 * @returns {{ kitId: number|null, mixId: number|null, productIds: number[] }}
 */
export function getCheckoutWooProductIds({
  bundleNumber,
  hasDandruff = false,
  includeHealthMix = true,
  gender = null,
} = {}) {
  const kitId = getWooProductId(bundleNumber, includeHealthMix, hasDandruff, gender);
  return {
    kitId: kitId || null,
    mixId: null,
    productIds: kitId ? [kitId] : [],
  };
}

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

  if (bundleNumber === 6 || gender === "female") {
    return stageLabel
      ? `Women Advance Hair Regrowth Kit — ${stageLabel}`
      : "Women Advance Hair Regrowth Kit";
  }

  if (bundleNumber === 1) {
    return stageLabel
      ? `Men Advance Hair Regrowth Kit — ${stageLabel}`
      : "Men Advance Hair Regrowth Kit";
  }

  const config = BUNDLE_CONFIG[bundleNumber];
  if (config?.label) return config.label;

  return stageLabel
    ? `Stage ${stageLabel} Hair Regrowth Kit`
    : "Hair Regrowth Kit";
}

export function getWooProductId(
  bundleNumber,
  _includeHealthMix = true,
  _hasDandruff = false,
  _gender = null
) {
  const config = BUNDLE_CONFIG[bundleNumber];
  if (!config) return null;
  return Number(config.wooProductId) || null;
}

export function getSeparateHealthMixWooId(
  _bundleNumber,
  _includeHealthMix = true,
  _hasDandruff = false,
  _gender = null
) {
  return null;
}

export function getBundlePrices(bundleNumber, _hasDandruff = false, _gender = null) {
  const config = BUNDLE_CONFIG[bundleNumber];
  if (!config) return { priceWithMix: 0, priceWithoutMix: 0, originalPrice: 0 };
  return {
    priceWithMix: config.priceWithMix,
    priceWithoutMix: config.priceWithoutMix,
    originalPrice: config.originalPrice,
  };
}

/**
 * Route quiz result → kit by gender + stage.
 * Female always gets Women Advance (8590).
 * Male gets stage-specific kit (8588 / 8594–8597).
 */
export function resolveBundleNumber(gender, stage, _hasDandruff) {
  const stageStr = String(stage ?? "");
  const isFemale = gender === "female";

  if (isFemale) return 6;

  if (stageStr === "1" || stageStr === "overall-thinning") return 1;
  if (stageStr === "2") return 2;
  if (stageStr === "3") return 3;
  if (stageStr === "4") return 4;
  if (stageStr === "5" || stageStr === "6" || stageStr === "7") return 5;

  // Fallback → Men Advance
  return 1;
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
