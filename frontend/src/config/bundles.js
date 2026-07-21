
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
    wooProductId: 8315,
    wooProductIdNoMix: 8325,
    priceWithMix: 2999,
    priceWithoutMix: 1399,
    originalPrice: 3273,
  },
  4: {
    label: "Bundle 7 — Female Stage 2–3",
    pdfBundle: "Bundle-7",
    wooProductId: 8317,
    wooProductIdNoMix: 8327,
    priceWithMix: 2999,
    priceWithoutMix: 1699,
    originalPrice: 3523,
  },
    99: {
    label: "₹1 Test Bundle",
    wooProductId: 8363 , // Replace with your real WooCommerce test product ID
    wooProductIdNoMix: 8363 ,
    priceWithMix: 1,
    priceWithoutMix: 1,
    originalPrice: 1,
  },
};


export const TEST_BUNDLE_NUMBER = 99;
export const HAIR_HEALTH_MIX_ID = "zylk-hair-health-mix";

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

  if (bundleNumber === 2) {
    // Bundle-2 — male pattern loss + dandruff
    return stageLabel
      ? `Zylk ProGro Scalp-Clear Kit — ${stageLabel} Men`
      : "Zylk ProGro Scalp-Clear Kit — Men";
  }

  if (bundleNumber === 4) {
    // Bundle-7 — female stage 2–3
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
export function getWooProductId(bundleNumber, includeHealthMix = true) {
  const config = BUNDLE_CONFIG[bundleNumber];
  if (!config) return null;
  return includeHealthMix ? config.wooProductId : config.wooProductIdNoMix;
}
export function getBundlePrices(bundleNumber) {
  const config = BUNDLE_CONFIG[bundleNumber];
  if (!config) return { priceWithMix: 0, priceWithoutMix: 0, originalPrice: 0 };
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
  // Stage 1 / overall thinning → Bundle-5 (dermaroller stripped later if dandruff)
  if (stageStr === "1" || stageStr === "overall-thinning") return 3;
  // Female stage 2–3 → Bundle-7 (dermaroller stripped later if dandruff)
  if (isFemale && ["2", "3"].includes(stageStr)) return 4;
  // Male stage 2–5: dandruff → Bundle-2 (no dermaroller); otherwise Bundle-1
  if (isMale && ["2", "3", "4", "5"].includes(stageStr)) return hasDandruff ? 2 : 1;
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