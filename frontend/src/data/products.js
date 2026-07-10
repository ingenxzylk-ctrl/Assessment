import {
  BUNDLE_CONFIG,
  resolveBundleNumber,
  getBundleDisplayName,
  getBundlePrices,
  getWooProductId,
  HAIR_HEALTH_MIX_ID,
} from "../config/bundles";

export { HAIR_HEALTH_MIX_ID };

/**
 * Builds the in-app product list shown on the Result page.
 */
export const getCustomBundle = (gender, stage, hasDandruff, rootCauses = []) => {
  const isMale = gender === "male";
  const stageString = String(stage);
  const isStage1 = stageString === "1";

  let growthTreatmentItem = {};
  if (isStage1) {
    growthTreatmentItem = {
      id: "prod-rosemary-concentrate",
      name: "Premium Rosemary Follicle Growth Concentrate",
      subtitle: "Natural Root Revitalizer & Anti-Thinning Serum",
      price: 699,
    };
  } else {
    growthTreatmentItem = isMale
      ? {
          id: "prod-minox-male-rx",
          name: "Rx: 5% Minoxidil + 0.1% Finasteride Topical Solution",
          subtitle: "Dual-Action Synergistic Hairline Restoration Fluid",
          price: 850,
        }
      : {
          id: "prod-minox-female-rx",
          name: "Rx: 2% Minoxidil Topical Solution",
          subtitle: "Gentle Hair Density Activator Optimized for Women",
          price: 750,
        };
  }

  const oilItem = hasDandruff
    ? {
        id: "prod-oil-mct-dandruff",
        name: "Custom ProGro Oil (Anti-Dandruff MCT Base)",
        subtitle: "MCT Oil Base enriched with Tea Tree + Rosemary + Peppermint Oil",
        price: 599,
      }
    : {
        id: "prod-oil-jojoba-clear",
        name: "Custom ProGro Oil (Nourishing Jojoba Base)",
        subtitle: "Pure Jojoba Base blended with Rosemary + Peppermint Oil",
        price: 599,
      };

  let supplementName = `Customized Advanced ${isMale ? "Male" : "Female"} Hair Vitality Complex`;
  let supplementSubtitle = "";

  if (rootCauses.length > 0) {
    supplementSubtitle = `Daily capsules targeting: ${rootCauses.join(" + ")}`;
  } else {
    supplementName = "Advanced Hair Supplement Mix";
    supplementSubtitle = "Premium balanced mix of Proteins, Amino Acids, Collagen, and Vitamin D3";
  }

  const supplementItem = {
    id: `prod-supplements-${gender}-${isStage1 ? "stage1" : "remedy"}`,
    name: supplementName,
    subtitle: supplementSubtitle,
    price: 800,
  };

  const itemsList = [
    growthTreatmentItem,
    { id: "prod-derma", name: "Scalp Micro-Needling Derma Roller (0.5mm)", subtitle: "Follicle Cluster Micro-Channel Activator", price: 350 },
    { id: "prod-shampoo", name: "Clinical Anti-Dandruff Clarifying Shampoo", subtitle: "pH-Balanced Botanical Scalp Cleanser", price: 350 },
    { id: "prod-massager", name: "Ergonomic Silicone Scalp Massager Brush", subtitle: "Micro-Circulation Deep Tissue Stimulator", price: 250 },
    oilItem,
    supplementItem,
  ];

  return {
    bundleId: `combo-pack-complete-${gender}-stage${stageString}`,
    bundleTitle: `Complete Customized ${isMale ? "Male" : "Female"} Hair Recovery System`,
    originalPrice: 3999,
    bundlePrice: 2999,
    items: itemsList,
  };
};

/**
 * Routes quiz result → bundle 1–4 with WooCommerce IDs and dynamic cart name.
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
  const custom = getCustomBundle(gender, stage, hasDandruff, rootCauses);
  const displayName = getBundleDisplayName(bundleNumber, gender, stage);
  const price = includeHealthMix ? prices.priceWithMix : prices.priceWithoutMix;

  return {
    ...custom,
    bundleNumber,
    bundleId: `bundle-${bundleNumber}-${gender}-stage${String(stage)}`,
    bundleTitle: displayName,
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