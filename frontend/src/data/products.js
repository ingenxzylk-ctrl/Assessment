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

/**
 * @deprecated Prefer getRecommendedBundle()
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
 * Routes quiz result → stage kit (male 8588/8594–8597, female 8590).
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

  const items = getBundleItems(bundleNumber, includeHealthMix, Boolean(hasDandruff)).map(
    (item) => {
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
    }
  );

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
    price: prices.priceWithoutMix,
    originalPrice: prices.originalPrice,
    includeHealthMix: false,
    hasDandruff: Boolean(hasDandruff),
    usesSeparateHealthMix: separateMix,
    wooProductId: kitId,
    wooHealthMixProductId: mixId,
    wooProductIdWithMix: config?.wooProductId ?? null,
    wooProductIdNoMix: config?.wooProductIdNoMix ?? config?.wooProductId ?? null,
  };
};
