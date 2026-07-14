import {
  BUNDLE_CONFIG,
  resolveBundleNumber,
  getBundleDisplayName,
  getBundlePrices,
  getWooProductId,
  HAIR_HEALTH_MIX_ID,
} from "../config/bundles";
import { getBundleItems, HAIR_HEALTH_MIX_ID as CATALOG_MIX_ID } from "./zylkProductCatalog";

export { HAIR_HEALTH_MIX_ID };

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
  const prices = getBundlePrices(bundleNumber);
  const displayName = getBundleDisplayName(bundleNumber, gender, stage);

  // Always include Health Mix in the list so the Result UI can show the toggle;
  // price still respects includeHealthMix.
  const items = getBundleItems(bundleNumber, true).map((item) => {
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
    wooProductId: getWooProductId(bundleNumber, includeHealthMix),
    wooProductIdWithMix: config?.wooProductId ?? null,
    wooProductIdNoMix: config?.wooProductIdNoMix ?? null,
  };
};
