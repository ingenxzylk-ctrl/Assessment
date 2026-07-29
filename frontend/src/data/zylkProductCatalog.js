/**
 * Zylk Health product catalog — Hair Regrowth kits (Jul 2026).
 *
 * Sale / MRP shown as price / originalPrice.
 */
export const ZYLK_PRODUCTS = {
  "zylk-minoxidil-finasteride": {
    id: "zylk-minoxidil-finasteride",
    name: "5% Minoxidil + 0.1% Finasteride",
    subtitle: "Topical hair regrowth solution for men",
    price: 499,
    originalPrice: 599,
    imgUrl: "/products/minoxidil-5.jpg",
  },
  "zylk-antidandruff-shampoo": {
    id: "zylk-antidandruff-shampoo",
    name: "Anti Dandruff Shampoo",
    subtitle: "Clears flakes while supporting scalp health",
    price: 152,
    originalPrice: 199,
    imgUrl: "/products/antidandruff-shampoo.jpg",
  },
  "zylk-dermaroller": {
    id: "zylk-dermaroller",
    name: "Dermaroller",
    subtitle: "0.5 mm scalp micro-needling tool",
    price: 149,
    originalPrice: 199,
    imgUrl: "/products/dermaroller.jpg",
  },
  "zylk-pumpkin-seed": {
    id: "zylk-pumpkin-seed",
    name: "Pumpkin Seed Softgel",
    subtitle: "Nutritional support for hair health",
    price: 199,
    originalPrice: 299,
    imgUrl: "/products/pumpkin.jpg",
  },
  "zylk-serum": {
    id: "zylk-serum",
    name: "Serum",
    subtitle: "Targeted scalp serum for density support",
    price: 200,
    originalPrice: 299,
    imgUrl: "/products/serum.jpg",
  },
  "zylk-advanced-serum": {
    id: "zylk-advanced-serum",
    name: "Advanced Serum",
    subtitle: "Advanced formula for later-stage regrowth",
    price: 300,
    originalPrice: 399,
    imgUrl: "/products/serum.jpg",
  },
  "zylk-scalp-massager": {
    id: "zylk-scalp-massager",
    name: "Scalp Massager",
    subtitle: "Boosts circulation during treatment",
    price: 99,
    originalPrice: 129,
    imgUrl: "/products/scalp-massager.jpg",
  },
  "zylk-scalp-massager-complimentary": {
    id: "zylk-scalp-massager-complimentary",
    name: "Scalp Massager",
    subtitle: "Included complimentary with this kit",
    price: 0,
    originalPrice: 129,
    imgUrl: "/products/scalp-massager.jpg",
  },
  "zylk-rosemary-oil": {
    id: "zylk-rosemary-oil",
    name: "Rosemary Hair Oil",
    subtitle: "Rosemary, peppermint & jojoba scalp oil",
    price: 199,
    originalPrice: 299,
    imgUrl: "/products/rosemary-oil.jpg",
  },
  "zylk-rosemary-mist": {
    id: "zylk-rosemary-mist",
    name: "Rosemary Mist Spray",
    subtitle: "Lightweight rosemary scalp mist",
    price: 149,
    originalPrice: 249,
    imgUrl: "/products/rosemary-mist.jpg",
  },
  "zylk-salicylic-shampoo": {
    id: "zylk-salicylic-shampoo",
    name: "Salicylic Acid Shampoo",
    subtitle: "Clarifying detox shampoo for the scalp",
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
