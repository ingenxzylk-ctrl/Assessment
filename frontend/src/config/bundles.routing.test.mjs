import {
  BUNDLE_CONFIG,
  STAGE_KIT_WOO_IDS,
  resolveBundleNumber,
  getWooProductId,
  getBundlePrices,
  isHeavyDandruff,
} from "./bundles.js";
import { getBundleItems } from "../data/zylkProductCatalog.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function namesOf(bundleNumber) {
  return getBundleItems(bundleNumber).map((p) => p.name);
}

const cases = [
  ["male", "1", "moderate", 1, 8588, 999, 1125],
  ["male", "1", "no", 1, 8588, 999, 1125],
  ["male", "1", "frequent", 8, 8838, 749, 829],
  ["female", "1", "frequent", 8, 8838, 749, 829],
  ["male", "1", "heavy", 8, 8838, 749, 829],
  ["female", "1", "moderate", 6, 8590, 999, 1125],
  ["female", "1", "no", 6, 8590, 999, 1125],
  ["female", "3", "no", 7, 8327, 999, 1100],
  ["female", "3", "moderate", 7, 8327, 999, 1100],
  ["female", "2", "no", 6, 8590, 999, 1125],
  ["female", "2", "frequent", 6, 8590, 999, 1125],
  ["female", "2", "moderate", 6, 8590, 999, 1125],
  ["female", "Stage 3", "no", 7, 8327, 999, 1100],
  ["male", "3", "no", 3, 8595, 1199, 1595],
  ["male", "6", "no", 5, 8597, 1299, 1824],
  ["male", "2", "frequent", 2, 8594, 999, 1296],
];

for (const [gender, stage, dandruff, bundle, wooId, price, original] of cases) {
  const n = resolveBundleNumber(gender, stage, dandruff);
  assert(n === bundle, `${gender} stage ${stage} ${dandruff}: expected bundle ${bundle}, got ${n}`);
  assert(getWooProductId(n) === wooId, `${gender} stage ${stage}: expected woo ${wooId}, got ${getWooProductId(n)}`);
  const prices = getBundlePrices(n);
  assert(prices.priceWithMix === price, `${gender} stage ${stage}: expected price ${price}, got ${prices.priceWithMix}`);
  assert(prices.originalPrice === original, `${gender} stage ${stage}: expected original ${original}, got ${prices.originalPrice}`);
}

assert(!isHeavyDandruff("moderate"), "moderate is not heavy");
assert(!isHeavyDandruff(true), "boolean true must not be treated as heavy (would mis-route mild dandruff)");
assert(isHeavyDandruff("frequent"), "frequent is heavy");
assert(STAGE_KIT_WOO_IDS.includes(8588), "8588 allow-listed");
assert(STAGE_KIT_WOO_IDS.includes(8327), "8327 allow-listed");
assert(STAGE_KIT_WOO_IDS.includes(8838), "8838 allow-listed");
assert(BUNDLE_CONFIG[1].wooProductId === 8588, "bundle 1 is 8588");

const womenAdvance = namesOf(6);
assert(womenAdvance.includes("Hair Growth Serum"), `women advance missing serum: ${womenAdvance.join(", ")}`);
assert(womenAdvance.includes("Rosemary Hair Oil"), "women advance missing rosemary oil");
assert(getBundleItems(6).find((p) => p.name === "Scalp Massager")?.price === 0, "women advance massager should be free");

const womenS3 = getBundleItems(7);
assert(womenS3.length === 5, `stage 3 female should have 5 products, got ${womenS3.length}`);
assert(womenS3.some((p) => p.name === "2% Minoxidil" && p.price === 499 && p.originalPrice === 599), "stage 3 female needs 2% Minoxidil ₹499/₹599");
assert(womenS3.some((p) => p.name === "Advanced Hair Serum" && p.price === 200 && p.originalPrice === 399), "stage 3 female needs Advanced Hair Serum ₹200/₹399");
assert(womenS3.some((p) => p.name === "Salicylic Acid Shampoo" && p.originalPrice === 199), "stage 3 salicylic regular ₹199");
assert(womenS3.some((p) => p.name === "Dermaroller" && p.price === 149), "stage 3 female needs Dermaroller");
assert(womenS3.some((p) => p.name === "Scalp Massager" && p.price === 99), "stage 3 female massager ₹99");
assert(!womenS3.some((p) => /rosemary/i.test(p.name)), "stage 3 female should not list rosemary products");
assert(!womenS3.some((p) => p.name === "Serum" && p.originalPrice === 299), "stage 3 female must not use the generic Serum SKU");

const anti = namesOf(8);
assert(
  anti.join("|") === "Tea Tree Oil|Tea Tree Mist Spray|Anti-Dandruff Shampoo|Scalp Massager|Hair Growth Serum",
  `antidandruff kit items: ${anti.join(", ")}`
);

console.log(`ok ${cases.length} routing cases + kit contents`);
