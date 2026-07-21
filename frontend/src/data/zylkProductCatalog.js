/**
 * Zylk Health product catalog — from official Sheet 1 (bundle allocation).
 *
 * Bundle-1: pattern hair loss, male stage 2–5 (no dandruff)
 * Bundle-2: pattern hair loss + dandruff, male stage 2–5  ← NO dermaroller
 * Bundle-5: stage 1 men/women, overall thinning
 * Bundle-7: female stage 2–3
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
    subtitle:
      "2% Rosemary Oil, 2% Peppermint Oil, 48% Jojoba Oil, 48% Grapeseed Oil, 0.1% Vitamin E",
    price: 299,
    imgUrl: "/products/rosemary-oil.jpg",
  },
  "zylk-progro-oil": {
    id: "zylk-progro-oil",
    name: "Zylk ProGro Oil",
    subtitle:
      "94% CCTG, 2% Tea Tree Oil, 2% Rosemary Oil, 2% Peppermint Oil, 0.1% Vitamin E",
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

/**
 * Official Sheet 1 allocation (quiz bundle numbers → PDF bundle numbers):
 * 1 → Bundle-1 (male 2–5, no dandruff)
 * 2 → Bundle-2 (male 2–5, dandruff)
 * 3 → Bundle-5 (stage 1 / overall thinning)
 * 4 → Bundle-7 (female 2–3, no dandruff — includes dermaroller)
 * 5 → Female 2–3 WITH dandruff (Minoxidil 2% + ProGro Scalp-Clear items, no dermaroller)
 */
export const BUNDLE_PRODUCT_IDS = {
  // Bundle-1 — male pattern loss stage 2–5, no dandruff
  1: [
    "zylk-minoxidil-5",
    "zylk-rosemary-oil",
    "zylk-detox-shampoo",
    "zylk-dermaroller",
    "zylk-scalp-massager",
    "zylk-tea-tree-conditioner",
  ],
  // Bundle-2 — male pattern loss stage 2–5 WITH dandruff (no dermaroller)
  2: [
    "zylk-minoxidil-5",
    "zylk-progro-oil",
    "zylk-tea-tree-mist",
    "zylk-antidandruff-shampoo",
    "zylk-scalp-massager",
  ],
  // Bundle-5 — stage 1 / overall thinning
  3: [
    "zylk-rosemary-oil",
    "zylk-rosemary-mist",
    "zylk-detox-shampoo",
    "zylk-dermaroller",
    "zylk-scalp-massager",
    "zylk-tea-tree-conditioner",
  ],
  // Bundle-7 — female stage 2–3, NO dandruff (includes dermaroller)
  4: [
    "zylk-minoxidil-2",
    "zylk-rosemary-oil",
    "zylk-detox-shampoo",
    "zylk-dermaroller",
    "zylk-scalp-massager",
    "zylk-tea-tree-conditioner",
  ],
  // Female stage 2–3 WITH dandruff — no dermaroller
  // Antidandruff shampoo, Minoxidil 2%, scalp massager, ProGro oil, tea-tree mist (+ Health Mix optional)
  5: [
    "zylk-minoxidil-2",
    "zylk-progro-oil",
    "zylk-tea-tree-mist",
    "zylk-antidandruff-shampoo",
    "zylk-scalp-massager",
  ],
};

export const HAIR_HEALTH_MIX_ID = "zylk-hair-health-mix";

/** List price from Zylk Health product sheet (₹1799) */
export const HAIR_HEALTH_MIX_PRICE = 1799;

export function getProductById(id) {
  return ZYLK_PRODUCTS[id] ? { ...ZYLK_PRODUCTS[id] } : null;
}

/**
 * @param {number} bundleNumber
 * @param {boolean} includeHealthMix
 * @param {boolean} [hasDandruff=false] — Sheet rule: never include dermaroller when dandruff is present
 */
export function getBundleItems(bundleNumber, includeHealthMix = true, hasDandruff = false) {
  const ids = [...(BUNDLE_PRODUCT_IDS[bundleNumber] || [])];

  // Never recommend a dermaroller when the user has dandruff
  // (Bundles 2 and 5 already omit it; also strip from other kits if dandruff)
  const filteredIds =
    hasDandruff || Number(bundleNumber) === 2 || Number(bundleNumber) === 5
      ? ids.filter((id) => id !== "zylk-dermaroller")
      : ids;

  const items = filteredIds.map((id) => getProductById(id)).filter(Boolean);

  if (includeHealthMix) {
    const mix = getProductById(HAIR_HEALTH_MIX_ID);
    if (mix) items.push({ ...mix, included: true });
  }

  return items;
}
