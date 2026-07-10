/**
 * Maps bundle products → images in frontend/public/products/
 */
const PRODUCT_IMAGES_BY_ID = {
  "prod-minox-male-rx": "/products/minoxidil-5.jpg",
  "prod-minox-female-rx": "/products/minoxidil-2.jpg",
  "prod-rosemary-concentrate": "/products/rosemary-oil.jpg",
  "prod-derma": "/products/dermaroller.jpg",
  "prod-shampoo": "/products/antidandruff-shampoo.jpg",
  "prod-massager": "/products/scalp-massager.jpg",
  "prod-oil-mct-dandruff": "/products/progro-oil.jpg",
  "prod-oil-jojoba-clear": "/products/progro-oil.jpg",
};

const PRODUCT_IMAGE_MAP = [
  { match: /supplement|vitality|health.?mix|capsule/i, img: "/products/health-mix.jpg" },
  { match: /2%|female.*minoxidil|minox.*female/i, img: "/products/minoxidil-2.jpg" },
  { match: /5%|finasteride|male.*minoxidil|minox.*male/i, img: "/products/minoxidil-5.jpg" },
  { match: /minoxidil/i, img: "/products/minoxidil-5.jpg" },
  { match: /rosemary.*mist|follicle.*mist/i, img: "/products/rosemary-mist.jpg" },
  { match: /rosemary|concentrate/i, img: "/products/rosemary-oil.jpg" },
  { match: /detox/i, img: "/products/detox-shampoo.jpg" },
  { match: /anti.?dandruff|dandruff.*shampoo|shampoo|cleanser/i, img: "/products/antidandruff-shampoo.jpg" },
  { match: /derma|roller|microneedl/i, img: "/products/dermaroller.jpg" },
  { match: /massager|brush/i, img: "/products/scalp-massager.jpg" },
  { match: /conditioner|tea.?tree/i, img: "/products/tea-tree-conditioner.jpg" },
  { match: /progro|jojoba|mct|oil/i, img: "/products/progro-oil.jpg" },
];

export const DEFAULT_PRODUCT_IMAGE = "/products/health-mix.jpg";

export function getProductImageUrl(product = {}, isFemale = false) {
  const id = product.id || "";

  if (PRODUCT_IMAGES_BY_ID[id]) {
    return PRODUCT_IMAGES_BY_ID[id];
  }

  if (id.startsWith("prod-supplements")) {
    return "/products/health-mix.jpg";
  }

  const haystack = `${id} ${product.name || ""} ${product.subtitle || ""}`;

  if (/minoxidil/i.test(haystack)) {
    return isFemale ? "/products/minoxidil-2.jpg" : "/products/minoxidil-5.jpg";
  }

  for (const entry of PRODUCT_IMAGE_MAP) {
    if (entry.match.test(haystack)) return entry.img;
  }

  return DEFAULT_PRODUCT_IMAGE;
}

export function shortenProductName(name = "", isFemale = false) {
  const lower = name.toLowerCase();

  if (isFemale && lower.includes("finasteride")) return null;

  if (lower.includes("minoxidil")) {
    return isFemale ? "Minoxidil 2% Serum (Female)" : "Minoxidil 5% + Finasteride Serum";
  }
  if (lower.includes("rosemary")) return "Rosemary Growth Concentrate";
  if (lower.includes("derma") || lower.includes("roller")) return "Scalp Derma Roller (0.5mm)";
  if (lower.includes("shampoo") || lower.includes("cleanser")) return "Anti-Dandruff Cleanser";
  if (lower.includes("massager") || lower.includes("brush")) return "Zylk Scalp Massager";
  if (lower.includes("conditioner") || lower.includes("tea tree")) return "Zylk Tea Tree Conditioner";
  if (lower.includes("health mix") || lower.includes("supplement") || lower.includes("vitality")) {
    return "Zylk Hair Health Mix";
  }
  if (lower.includes("oil") || lower.includes("progro")) return "Custom ProGro Oil";

  return name;
}

export function formatBundleProduct(product, isFemale = false) {
  const shortName = shortenProductName(product?.name, isFemale);
  if (!shortName) return null;

  return {
    shortName,
    imgUrl: getProductImageUrl(product, isFemale),
  };
}