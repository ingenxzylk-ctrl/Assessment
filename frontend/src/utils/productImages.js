/**
 * Maps bundle product id/name keywords → public image paths.
 * Add your real product photos under frontend/public/products/ with the same filenames.
 */
const PRODUCT_IMAGE_MAP = [
  { match: /shampoo|cleanser|anti-dandruff/i, img: "/products/anti-dandruff-cleanser.svg" },
  { match: /derma|roller|microneedl/i, img: "/products/derma-roller.svg" },
  { match: /massager|brush/i, img: "/products/scalp-massager.svg" },
  { match: /conditioner|tea.?tree/i, img: "/products/tea-tree-conditioner.svg" },
  { match: /health.?mix|supplement|vitality|capsule/i, img: "/products/hair-health-mix.svg" },
  { match: /minoxidil|finasteride|serum|rosemary|growth|concentrate/i, img: "/products/growth-serum.svg" },
  { match: /oil|progro|jojoba|mct/i, img: "/products/progro-oil.svg" },
];

export const DEFAULT_PRODUCT_IMAGE = "/products/default-product.svg";

export function getProductImageUrl(product = {}) {
  const haystack = `${product.id || ""} ${product.name || ""} ${product.subtitle || ""}`;

  for (const entry of PRODUCT_IMAGE_MAP) {
    if (entry.match.test(haystack)) return entry.img;
  }

  return DEFAULT_PRODUCT_IMAGE;
}

export function shortenProductName(name = "", isFemale = false) {
  const lower = name.toLowerCase();

  if (isFemale && lower.includes("finasteride")) return null;

  if (lower.includes("minoxidil")) {
    return isFemale ? "Targeted Growth Serum (Female Formula)" : "Minoxidil + Finasteride Serum";
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
  if (lower.includes("hair health mix")) return "Zylk Hair Health Mix";

  return name;
}

export function formatBundleProduct(product, isFemale = false) {
  const shortName = shortenProductName(product?.name, isFemale);
  if (!shortName) return null;

  return {
    shortName,
    imgUrl: getProductImageUrl(product),
  };
}
