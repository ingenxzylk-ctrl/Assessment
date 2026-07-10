import {
  BUNDLE_CONFIG,
  resolveBundleNumber,
  getBundleDisplayName,
  getBundlePrices,
  getWooProductId,
  HAIR_HEALTH_MIX_ID,
} from "../config/bundles";
import { getBundleItems } from "./zylkProductCatalog";

export { HAIR_HEALTH_MIX_ID };

export const getRecommendedBundle = (
  gender,
  stage,
  hasDandruff,
  _rootCauses = [],
  includeHealthMix = true
) => {
  const bundleNumber = resolveBundleNumber(gender, stage, hasDandruff);
  const config = BUNDLE_CONFIG[bundleNumber];
  const prices = getBundlePrices(bundleNumber);
  const displayName = getBundleDisplayName(bundleNumber, gender, stage);
  const price = includeHealthMix ? prices.priceWithMix : prices.priceWithoutMix;
  const items = getBundleItems(bundleNumber, includeHealthMix);

  return {
    bundleNumber,
    bundleId: `bundle-${bundleNumber}-${gender}-stage${String(stage)}`,
    bundleTitle: displayName,
    items,
    bundlePrice: prices.priceWithMix,
    priceWithoutMix: prices.priceWithoutMix,
    price,
    originalPrice: prices.originalPrice,
    includeHealthMix,
    wooProductId: getWooProductId(bundleNumber, includeHealthMix),
    wooProductIdWithMix: config.wooProductId,
    wooProductIdNoMix: config.wooProductIdNoMix,
  };
};

// Keep for backward compatibility if anything still imports it
export const getCustomBundle = (gender, stage, hasDandruff, rootCauses, includeHealthMix) =>
  getRecommendedBundle(gender, stage, hasDandruff, rootCauses, includeHealthMix);