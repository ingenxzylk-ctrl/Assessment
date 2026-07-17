/**
 * Zylk Health product catalog — from official bundle sheet
 */
export const ZYLK_PRODUCTS = {
  "zylk-minoxidil-5": {
    id: "zylk-minoxidil-5",
    name: "Zylk Minoxidil 5% Solution",
    subtitle: "Pattern hair loss treatment for men stage 2–5",
    price: 599,
    imgUrl: "/products/minoxidil-5.jpg",
  },
  "zylk-minoxidil-2": {
    id: "zylk-minoxidil-2",
    name: "Zylk Minoxidil 2% Solution",
    subtitle: "Gentle formula for female stage 2–3",
    price: 499,
    imgUrl: "/products/minoxidil-2.jpg",
  },
  "zylk-rosemary-oil": {
    id: "zylk-rosemary-oil",
    name: "Zylk Rosemary Hair Oil",
    subtitle: "2% Rosemary, 2% Peppermint, 48% Jojoba, 48% Grapeseed, 0.1% Vitamin E",
    price: 299,
    imgUrl: "/products/rosemary-oil.jpg",
  },
  "zylk-progro-oil": {
    id: "zylk-progro-oil",
    name: "Zylk ProGro Oil",
    subtitle: "94% CCTG, 2% Tea Tree, 2% Rosemary, 2% Peppermint, 0.1% Vitamin E",
    price: 499,
    imgUrl: "/products/progro-oil.jpg",
  },
  "zylk-detox-shampoo": {
    id: "zylk-detox-shampoo",
    name: "Zylk Detox Salicylic Acid Shampoo",
    subtitle: "Clarifying scalp cleanser",
    price: 299,
    imgUrl: "/products/detox-shampoo.jpg",
  },
  "zylk-antidandruff-shampoo": {
    id: "zylk-antidandruff-shampoo",
    name: "Zylk Antidandruff Shampoo",
    subtitle: "For dandruff + pattern hair loss",
    price: 349,
    imgUrl: "/products/antidandruff-shampoo.jpg",
  },
  "zylk-dermaroller": {
    id: "zylk-dermaroller",
    name: "Zylk 0.5 mm Dermaroller",
    subtitle: "Scalp micro-needling tool",
    price: 199,
    imgUrl: "/products/dermaroller.jpg",
  },
  "zylk-scalp-massager": {
    id: "zylk-scalp-massager",
    name: "Zylk Scalp Massager",
    subtitle: "Boosts circulation during treatment",
    price: 129,
    imgUrl: "/products/scalp-massager.jpg",
  },
  "zylk-tea-tree-conditioner": {
    id: "zylk-tea-tree-conditioner",
    name: "Zylk Tea Tree Conditioner",
    subtitle: "Scalp-soothing conditioner",
    price: 299,
    imgUrl: "/products/tea-tree-conditioner.jpg",
  },
  "zylk-tea-tree-mist": {
    id: "zylk-tea-tree-mist",
    name: "Zylk Tea Tree Mist Spray",
    subtitle: "Refreshing scalp mist for dandruff care",
    price: 249,
    // Dedicated asset can be added later; rosemary mist is the closest available image
    imgUrl: "/products/rosemary-mist.jpg",
    imgFallbacks: ["/products/tea-tree-mist.jpg"],
  },
  "zylk-rosemary-mist": {
    id: "zylk-rosemary-mist",
    name: "Zylk Rosemary Mist Spray",
    subtitle: "Lightweight rosemary scalp mist",
    price: 249,
    imgUrl: "/products/rosemary-mist.jpg",
  },
  "zylk-hair-health-mix": {
    id: "zylk-hair-health-mix",
    name: "Zylk Hair Health Mix",
    subtitle: "Nutrition shake + supplement blend",
    price: 1799,
    imgUrl: "/products/health-mix.jpg",
  },
};

/** Products per quiz bundle (maps to PDF Bundle 1, 2, 5, 7) */
export const BUNDLE_PRODUCT_IDS = {
  1: [
    "zylk-minoxidil-5",
    "zylk-rosemary-oil",
    "zylk-detox-shampoo",
    "zylk-dermaroller",
    "zylk-scalp-massager",
    "zylk-tea-tree-conditioner",
  ],
  2: [
    "zylk-minoxidil-5",
    "zylk-progro-oil",
    "zylk-tea-tree-mist",
    "zylk-antidandruff-shampoo",
    "zylk-scalp-massager",
  ],
  3: [
    "zylk-rosemary-oil",
    "zylk-rosemary-mist",
    "zylk-detox-shampoo",
    "zylk-dermaroller",
    "zylk-scalp-massager",
    "zylk-tea-tree-conditioner",
  ],
  4: [
    "zylk-minoxidil-2",
    "zylk-rosemary-oil",
    "zylk-detox-shampoo",
    "zylk-dermaroller",
    "zylk-scalp-massager",
    "zylk-tea-tree-conditioner",
  ],
};

export const HAIR_HEALTH_MIX_ID = "zylk-hair-health-mix";

/** List price from Zylk Health product sheet (₹1799) */
export const HAIR_HEALTH_MIX_PRICE = 1799;

export function getProductById(id) {
  return ZYLK_PRODUCTS[id] ? { ...ZYLK_PRODUCTS[id] } : null;
}

export function getBundleItems(bundleNumber, includeHealthMix = true) {
  const ids = BUNDLE_PRODUCT_IDS[bundleNumber] || [];
  const items = ids.map((id) => getProductById(id)).filter(Boolean);

  if (includeHealthMix) {
    const mix = getProductById(HAIR_HEALTH_MIX_ID);
    if (mix) items.push({ ...mix, included: true });
  }

  return items;
}