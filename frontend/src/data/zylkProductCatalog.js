/**
 * Zylk Health product catalog — Hair Regrowth kits (Jul 2026).
 *
 * Sale / MRP shown as price / originalPrice.
 */
export const ZYLK_PRODUCTS = {
  "zylk-minoxidil-finasteride": {
    id: "zylk-minoxidil-finasteride",
    name: " Brings blood to roots and stops hormones that cause baldness.",
    subtitle: "5% Minoxidil + 0.1% Finasteride",
    price: 499,
    originalPrice: 599,
    imgUrl: "/products/minoxidil-5.jpg",
  },
  "zylk-antidandruff-shampoo": {
    id: "zylk-antidandruff-shampoo",
    name: " Cleans away flakes and germs so hair can grow healthy.",
    subtitle: "Anti Dandruff Shampoo",
    price: 152,
    originalPrice: 199,
    imgUrl: "/products/antidandruff-shampoo.jpg",
  },
  "zylk-dermaroller": {
    id: "zylk-dermaroller",
    name: "Makes tiny pokes in your skin so treatments absorb better.",
    subtitle: "Dermaroller",
    price: 149,
    originalPrice: 199,
    imgUrl: "/products/dermaroller.jpg",
  },
  "zylk-pumpkin-seed": {
    id: "zylk-pumpkin-seed",
    name: "Gives your body vitamins to fight hair loss from inside.",
    subtitle: "Pumpkin Seed Softgel",
    price: 199,
    originalPrice: 299,
    imgUrl: "/products/pumpkin.jpg",
  },
  "zylk-serum": {
    id: "zylk-serum",
    name: "Feeds the hair roots directly to make your hair thicker.",
    subtitle: "Serum",
    price: 200,
    originalPrice: 299,
    imgUrl: "/products/serum.jpg",
  },
  "zylk-advanced-serum": {
    id: "zylk-advanced-serum",
    name: "Fixes damaged hair and makes weak strands a lot stronger.",
    subtitle: "Advanced Serum",
    price: 300,
    originalPrice: 399,
    imgUrl: "/products/serum.jpg",
  },
  "zylk-scalp-massager": {
    id: "zylk-scalp-massager",
    name: "Rubs the head to wake up roots and mix serums.",
    subtitle: "Scalp Massager",
    price: 99,
    originalPrice: 129,
    imgUrl: "/products/scalp-massager.jpg",
  },
  "zylk-scalp-massager-complimentary": {
    id: "zylk-scalp-massager-complimentary",
    name: "Rubs the head to wake up roots and mix serums",
    subtitle: "Scalp Massager",
    price: 0,
    originalPrice: 129,
    imgUrl: "/products/scalp-massager.jpg",
  },
  "zylk-rosemary-oil": {
    id: "zylk-rosemary-oil",
    name: "Uses natural plant oils to feed and wake up roots.",
    subtitle: "Rosemary Hair Oil",
    price: 199,
    originalPrice: 299,
    imgUrl: "/products/rosemary-oil.jpg",
  },
  "zylk-rosemary-mist": {
    id: "zylk-rosemary-mist",
    name: "Daily spray to calm your skin and keep growing.",
    subtitle: "Rosemary Mist Spray",
    price: 149,
    originalPrice: 249,
    imgUrl: "/products/rosemary-mist.jpg",
  },
  "zylk-salicylic-shampoo": {
    id: "zylk-salicylic-shampoo",
    name: "Scrubs away dead skin to open pores for new hair.",
    subtitle: "Salicylic Acid Shampoo",
    price: 153,
    originalPrice: 249,
    imgUrl: "/products/detox-shampoo.jpg",
  },
  "zylk-hair-health-mix": {
    id: "zylk-hair-health-mix",
    name: "Zylk Hair Health Mix",
    subtitle: "Nutrition shake + supplement blend",
    price: 1799,
    originalPrice: 1799,
    imgUrl: "/products/health-mix.jpg",
  },
};

/**
 * Bundle numbers → product lists
 * 1 Men Advance (stage 1)
 * 2–5 Male stage kits
 * 6 Women Advance (all stages)
 */
export const BUNDLE_PRODUCT_IDS = {
  // Men Advance Hair Regrowth Kit (stage 1 / overall thinning)
  1: [
    "zylk-rosemary-oil",
    "zylk-rosemary-mist",
    "zylk-dermaroller",
    "zylk-scalp-massager",
    "zylk-salicylic-shampoo",
  ],
  // Stage 2 Hair Regrowth Kit
  2: [
    "zylk-minoxidil-finasteride",
    "zylk-antidandruff-shampoo",
    "zylk-dermaroller",
    "zylk-pumpkin-seed",
  ],
  // Stage 3 Hair Regrowth Kit
  3: [
    "zylk-minoxidil-finasteride",
    "zylk-antidandruff-shampoo",
    "zylk-dermaroller",
    "zylk-pumpkin-seed",
    "zylk-serum",
  ],
  // Stage 4 Hair Regrowth Kit
  4: [
    "zylk-minoxidil-finasteride",
    "zylk-antidandruff-shampoo",
    "zylk-dermaroller",
    "zylk-pumpkin-seed",
    "zylk-serum",
    "zylk-scalp-massager-complimentary",
  ],
  // Stage 5 Hair Regrowth Kit
  5: [
    "zylk-minoxidil-finasteride",
    "zylk-antidandruff-shampoo",
    "zylk-dermaroller",
    "zylk-pumpkin-seed",
    "zylk-advanced-serum",
    "zylk-scalp-massager-complimentary",
  ],
  // Women Advance Hair Regrowth Kit (all stages)
  6: [
    "zylk-rosemary-oil",
    "zylk-rosemary-mist",
    "zylk-dermaroller",
    "zylk-scalp-massager",
    "zylk-salicylic-shampoo",
  ],
};

export const HAIR_HEALTH_MIX_ID = "zylk-hair-health-mix";
export const HAIR_HEALTH_MIX_PRICE = 1799;

export function getProductById(id) {
  return ZYLK_PRODUCTS[id] ? { ...ZYLK_PRODUCTS[id] } : null;
}

/**
 * @param {number} bundleNumber
 * @param {boolean} [_includeHealthMix=true] — unused; new kits are fixed SKUs
 * @param {boolean} [_hasDandruff=false] — unused; stage kits already include the right shampoo
 */
export function getBundleItems(bundleNumber, _includeHealthMix = true, _hasDandruff = false) {
  const ids = [...(BUNDLE_PRODUCT_IDS[bundleNumber] || [])];
  return ids.map((id) => getProductById(id)).filter(Boolean);
}
