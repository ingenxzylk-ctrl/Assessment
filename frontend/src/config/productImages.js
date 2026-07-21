/**
 * Product images — resolved from src/assets/products (bundled by Vite) OR public/products.
 *
 * Put your JPG files in EITHER:
 *   frontend/src/assets/products/   ← recommended
 *   frontend/public/products/       ← served at /products/filename.jpg
 */

import { ZYLK_PRODUCTS } from "../data/zylkProductCatalog.js";

const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "svg"];

const bundledAssets = import.meta.glob("../assets/products/*", {
  eager: true,
  query: "?url",
  import: "default",
});

const bundledByFilename = Object.entries(bundledAssets).reduce((acc, [path, url]) => {
  const filename = path.split("/").pop()?.toLowerCase();
  if (filename) acc[filename] = url;
  return acc;
}, {});

const PRODUCT_CANDIDATE_BASES = {
  "prod-minox-male-rx": ["minoxidil-5"],
  "prod-minox-female-rx": ["minoxidil-2"],
  "prod-rosemary-concentrate": ["rosemary-oil", "rosemary-mist"],
  "prod-derma": ["dermaroller"],
  "prod-shampoo": ["antidandruff-shampoo", "detox-shampoo"],
  "prod-massager": ["scalp-massager"],
  "prod-oil-mct-dandruff": ["progro-oil"],
  "prod-oil-jojoba-clear": ["progro-oil"],
};

const KEYWORD_BASES = [
  { match: /supplement|vitality|health.?mix|capsule/i, bases: ["health-mix"] },
  { match: /2%|female.*minoxidil/i, bases: ["minoxidil-2"] },
  { match: /5%|finasteride|male.*minoxidil/i, bases: ["minoxidil-5"] },
  { match: /minoxidil/i, bases: ["minoxidil-5", "minoxidil-2"] },
  { match: /tea.?tree.*mist|mist.*tea.?tree/i, bases: ["rosemary-mist", "tea-tree-mist"] },
  { match: /rosemary.*mist/i, bases: ["rosemary-mist"] },
  { match: /rosemary|concentrate/i, bases: ["rosemary-oil", "rosemary-mist"] },
  { match: /detox/i, bases: ["detox-shampoo"] },
  { match: /anti.?dandruff|dandruff.*shampoo/i, bases: ["antidandruff-shampoo"] },
  { match: /shampoo|cleanser/i, bases: ["antidandruff-shampoo", "detox-shampoo"] },
  { match: /derma|roller|microneedl/i, bases: ["dermaroller"] },
  { match: /massager|brush/i, bases: ["scalp-massager"] },
  { match: /conditioner|tea.?tree/i, bases: ["tea-tree-conditioner"] },
  { match: /progro|jojoba|mct|oil/i, bases: ["progro-oil"] },
];

const DEFAULT_BASES = ["health-mix", "progro-oil"];

function expandBases(bases) {
  const files = [];
  for (const base of bases) {
    for (const ext of EXTENSIONS) {
      files.push(`${base}.${ext}`);
    }
  }
  return files;
}

function resolveFromBundled(filenames) {
  for (const name of filenames) {
    const url = bundledByFilename[name.toLowerCase()];
    if (url) return url;
  }
  return null;
}

function getCandidateBases(product = {}, isFemale = false) {
  const id = product.id || "";
  const haystack = `${id} ${product.name || ""} ${product.subtitle || ""}`;

  if (id.startsWith("prod-supplements")) {
    return ["health-mix"];
  }

  if (PRODUCT_CANDIDATE_BASES[id]) {
    return PRODUCT_CANDIDATE_BASES[id];
  }

  if (/minoxidil/i.test(haystack)) {
    return isFemale ? ["minoxidil-2"] : ["minoxidil-5"];
  }

  for (const entry of KEYWORD_BASES) {
    if (entry.match.test(haystack)) return entry.bases;
  }

  return DEFAULT_BASES;
}

export function getProductImageSources(product = {}, isFemale = false) {
  const bases = getCandidateBases(product, isFemale);
  const filenames = expandBases(bases);

  const bundled = resolveFromBundled(filenames);
  if (bundled) {
    return { src: bundled, fallbacks: [] };
  }

  const uniquePublic = [...new Set(filenames)];
  return {
    src: `/products/${uniquePublic[0]}`,
    fallbacks: uniquePublic.slice(1).map((f) => `/products/${f}`),
  };
}

export function getProductImageUrl(product = {}, isFemale = false) {
  return getProductImageSources(product, isFemale).src;
}

export function shortenProductName(name = "", isFemale = false) {
  const lower = name.toLowerCase();

  if (isFemale && lower.includes("finasteride")) return null;

  // Names must match the official Zylk Health products sheet (most-specific first)
  if (lower.includes("minoxidil")) {
    if (lower.includes("2%")) return "Zylk Minoxidil 2% Solution";
    return isFemale ? "Zylk Minoxidil 2% Solution" : "Zylk Minoxidil 5% Solution";
  }
  if (lower.includes("tea tree mist") || lower.includes("tea-tree mist")) {
    return "Zylk Tea Tree Mist Spray";
  }
  if (lower.includes("rosemary mist")) return "Zylk Rosemary Mist Spray";
  if (lower.includes("rosemary") && lower.includes("oil")) return "Zylk Rosemary Hair Oil";
  if (lower.includes("rosemary")) return "Zylk Rosemary Hair Oil";
  if (lower.includes("progro")) return "Zylk ProGro Oil";
  if (lower.includes("derma") || lower.includes("roller")) return "Zylk 0.5 mm Dermaroller";
  if (lower.includes("antidandruff") || lower.includes("anti-dandruff")) {
    return "Zylk Antidandruff Shampoo";
  }
  if (lower.includes("detox") || lower.includes("salicylic")) {
    return "Zylk Detox Salicylic Acid Shampoo";
  }
  if (lower.includes("massager") || lower.includes("brush")) return "Zylk Scalp Massager";
  if (lower.includes("conditioner")) return "Zylk Tea Tree Conditioner";
  if (lower.includes("health mix") || lower.includes("supplement") || lower.includes("vitality")) {
    return "Zylk Hair Health Mix";
  }
  if (lower.includes("shampoo") || lower.includes("cleanser")) {
    return "Zylk Antidandruff Shampoo";
  }
  if (lower.includes("oil")) return "Zylk ProGro Oil";

  return name;
}

export function formatBundleProduct(product = {}, isFemale = false) {
  // Always prefer official sheet catalog name by id, then explicit name, then heuristic
  const catalog = product.id ? ZYLK_PRODUCTS[product.id] : null;
  const shortName =
    catalog?.name ||
    product.name ||
    shortenProductName(product?.name || product?.title || "", isFemale);
  if (!shortName) return null;

  const imgUrl = catalog?.imgUrl || product.imgUrl;
  const imgFallbacks = catalog?.imgFallbacks || product.imgFallbacks || [];

  if (imgUrl) {
    return {
      shortName,
      imgUrl,
      imgFallbacks,
    };
  }

  const { src, fallbacks } = getProductImageSources(product, isFemale);

  return {
    shortName,
    imgUrl: src,
    imgFallbacks: fallbacks,
  };
}

export const DEFAULT_PRODUCT_IMAGE = "/products/health-mix.jpg";