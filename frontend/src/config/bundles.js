/**
 * Single source of truth for bundle names, prices, and WooCommerce product IDs.
 */
export const BUNDLE_CONFIG = {
  1: {
    label: "Stage 2-5 Men (No Dandruff)",
    wooProductId: 8319 ,
    wooProductIdNoMix: 8307  ,
    priceWithMix: 2999,
    priceWithoutMix: 1799,
    originalPrice: 3999,
  },
  2: {
    label: "Stage 2-5 Men (Dandruff)",
    wooProductId: 8311  ,
    wooProductIdNoMix: 8323  ,
    priceWithMix: 2999,
    priceWithoutMix: 1799,
    originalPrice: 3999,
  },
  3: {
    label: "Stage 1 / Overall Thinning",
    wooProductId: 8315  ,
    wooProductIdNoMix: 8325  ,
    priceWithMix: 2999,
    priceWithoutMix: 1399,
    originalPrice: 3499,
  },
  4: {
    label: "Stage 2-3 Female",
    wooProductId: 8317  ,
    wooProductIdNoMix: 8327  ,
    priceWithMix: 2999,
    priceWithoutMix: 1699,
    originalPrice: 3799,
  },
  99: {
    label: "₹1 Test Bundle",
    wooProductId: 8329  ,        // ← replace with your real ₹1 WooCommerce product ID
    wooProductIdNoMix: 8329 ,
    priceWithMix: 1,
    priceWithoutMix: 1,
    originalPrice: 1,
  },
};

export const HAIR_HEALTH_MIX_ID = "hair-health-mix";
export const TEST_BUNDLE_NUMBER = 99;

export function getBundleDisplayName(bundleNumber, gender, stage) {
  if (bundleNumber === TEST_BUNDLE_NUMBER) return "₹1 Test Bundle";

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

/** ₹1 bundle — add to cart for checkout testing */
export function getTestBundle() {
  const config = BUNDLE_CONFIG[TEST_BUNDLE_NUMBER];
  return {
    id: "bundle-test-1rupee",
    bundleId: "bundle-test-1rupee",
    name: "₹1 Test Bundle",
    price: 1,
    priceWithMix: config.priceWithMix,
    priceWithoutMix: config.priceWithoutMix,
    originalPrice: config.originalPrice,
    bundleNumber: TEST_BUNDLE_NUMBER,
    includeHealthMix: true,
    isTestBundle: true,
    wooProductId: config.wooProductId,
    wooProductIdWithMix: config.wooProductId,
    wooProductIdNoMix: config.wooProductIdNoMix,
    subtitle: "1 rupee bundle for cart & checkout testing",
  };
}