/**
 * Single source of truth for bundle names, prices, and WooCommerce product IDs.
 * Replace placeholder IDs (8001–8008) with your real zylkhealth.com product IDs.
 */
export const BUNDLE_CONFIG = {
  1: {
    label: "Stage 2-5 Men (No Dandruff)",
    wooProductId: 8001,       // with Hair Health Mix
    wooProductIdNoMix: 8002,    // without Hair Health Mix
    priceWithMix: 2999,
    priceWithoutMix: 2499,
    originalPrice: 3999,
  },
  2: {
    label: "Stage 2-5 Men (Dandruff)",
    wooProductId: 8003,
    wooProductIdNoMix: 8004,
    priceWithMix: 2999,
    priceWithoutMix: 2499,
    originalPrice: 3999,
  },
  3: {
    label: "Stage 1 / Overall Thinning",
    wooProductId: 8005,
    wooProductIdNoMix: 8006,
    priceWithMix: 2499,
    priceWithoutMix: 1999,
    originalPrice: 3499,
  },
  4: {
    label: "Stage 2-3 Female",
    wooProductId: 8007,
    wooProductIdNoMix: 8008,
    priceWithMix: 2799,
    priceWithoutMix: 2299,
    originalPrice: 3799,
  },
  99: {
    label: "₹1 Test Bundle",
    wooProductId: 9999, // Replace with your real WooCommerce test product ID
    wooProductIdNoMix: 9999,
    priceWithMix: 1,
    priceWithoutMix: 1,
    originalPrice: 1,
  },
};

export const TEST_BUNDLE_NUMBER = 99;
export const HAIR_HEALTH_MIX_ID = "hair-health-mix";

export function getBundleDisplayName(bundleNumber, gender, stage) {
  const stageStr = String(stage ?? "");
  if (bundleNumber === 1) return "Stage 2-5 Men Product";
  if (bundleNumber === 2) return "Stage 2-5 Men Product (Dandruff)";
  if (bundleNumber === 4) return "Stage 2-3 Female Product";
  if (stageStr === "overall-thinning") return "Overall Thinning Product";
  return gender === "female" ? "Stage 1 Female Product" : "Stage 1 Men Product";
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

  if (stageStr === "1" || stageStr === "overall-thinning") return 3;
  if (isFemale && ["2", "3"].includes(stageStr)) return 4;
  if (isMale && ["2", "3", "4", "5"].includes(stageStr)) return hasDandruff ? 2 : 1;

  return 3;
}

/** ₹1 bundle for testing cart → WooCommerce checkout. Replace wooProductId 9999 with a real product. */
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
