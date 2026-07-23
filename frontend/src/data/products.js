import {
  BUNDLE_CONFIG,
  resolveBundleNumber,
  getBundleDisplayName,
  getBundlePrices,
  getCheckoutWooProductIds,
  usesSeparateHealthMixProduct,
  HAIR_HEALTH_MIX_ID,
} from "../config/bundles";
import {
  getBundleItems,
  HAIR_HEALTH_MIX_ID as CATALOG_MIX_ID,
} from "./zylkProductCatalog";

export { HAIR_HEALTH_MIX_ID };

/** List price from Zylk Health product sheet */
export const HAIR_HEALTH_MIX_PRICE = 1799;

function isDermarollerProduct(item = {}) {
  const id = String(item.id || "").toLowerCase();
  const name = String(item.name || item.title || "").toLowerCase();
  return (
    id.includes("derma") ||
    id.includes("roller") ||
    name.includes("derma") ||
    name.includes("roller") ||
    name.includes("micro-needling") ||
    name.includes("microneedl")
  );
}

/**
 * @deprecated Prefer getRecommendedBundle() which uses the official Zylk sheet.
 * Kept for any legacy callers.
 */
export const getCustomBundle = (gender, stage, hasDandruff, rootCauses = []) => {
  const recommended = getRecommendedBundle(gender, stage, hasDandruff, rootCauses, true);
  return {
    bundleId: recommended.bundleId,
    bundleTitle: recommended.bundleTitle,
    originalPrice: recommended.originalPrice,
    bundlePrice: recommended.bundlePrice,
    items: recommended.items,
  };
};

/**
 * Routes quiz result → official Zylk bundle (PDF Bundle 1 / 2 / 5 / 7)
 * with correct product list, WooCommerce IDs, and unique display name.
 *
 * Sheet 1 rules:
 * - Stage 1 / overall thinning → Bundle-5 (never Minoxidil / never Bundle-2)
 * - Male stage 2–5 + dandruff → Bundle-2 (no dermaroller)
 * - Male stage 2–5 no dandruff → Bundle-1
 * - Female stage 2–3 no dandruff → Bundle-7 (includes dermaroller)
 * - Female stage 2–3 + dandruff → Female Scalp-Clear (Minoxidil 2%, no dermaroller)
 */
export const getRecommendedBundle = (
  gender,
  stage,
  hasDandruff,
  rootCauses = [],
  includeHealthMix = true
) => {
  const bundleNumber = resolveBundleNumber(gender, stage, hasDandruff);
  const config = BUNDLE_CONFIG[bundleNumber];
  const prices = getBundlePrices(bundleNumber, Boolean(hasDandruff), gender);
  const displayName = getBundleDisplayName(bundleNumber, gender, stage);

  // Pull items from the official catalog for this bundle number.
  // Pass hasDandruff so dermaroller is stripped when present.
  let items = getBundleItems(bundleNumber, true, Boolean(hasDandruff)).map((item) => {
    if (item.id === CATALOG_MIX_ID || item.id === HAIR_HEALTH_MIX_ID) {
      return {
        ...item,
        subtitle:
          rootCauses.length > 0
            ? `Daily capsules targeting: ${rootCauses.join(" + ")}`
            : item.subtitle,
      };
    }
    return item;
  });

  // Hard guarantee: never ship a dermaroller when dandruff was reported
  if (hasDandruff) {
    items = items.filter((item) => !isDermarollerProduct(item));
  }

  const separateMix = usesSeparateHealthMixProduct(
    bundleNumber,
    Boolean(hasDandruff),
    gender
  );
  const { kitId, mixId } = getCheckoutWooProductIds({
    bundleNumber,
    hasDandruff: Boolean(hasDandruff),
    includeHealthMix,
    gender,
  });

  return {
    bundleNumber,
    bundleId: `bundle-${bundleNumber}-${gender}-stage${String(stage)}`,
    bundleTitle: displayName,
    items,
    bundlePrice: prices.priceWithMix,
    priceWithoutMix: prices.priceWithoutMix,
    price: includeHealthMix ? prices.priceWithMix : prices.priceWithoutMix,
    originalPrice: prices.originalPrice,
    includeHealthMix,
    hasDandruff: Boolean(hasDandruff),
    usesSeparateHealthMix: separateMix,
    wooProductId: kitId,
    wooHealthMixProductId: mixId,
    wooProductIdWithMix: separateMix
      ? kitId
      : (config?.wooProductId ?? null),
    wooProductIdNoMix: separateMix
      ? kitId
      : (config?.wooProductIdNoMix ?? null),
  };
};