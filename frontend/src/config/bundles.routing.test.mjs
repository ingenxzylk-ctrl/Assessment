import {
  BUNDLE_CONFIG,
  STAGE_KIT_WOO_IDS,
  resolveBundleNumber,
  getWooProductId,
  getBundlePrices,
  isHeavyDandruff,
} from "./bundles.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const cases = [
  ["male", "1", "moderate", 1, 8588, 749, 1125],
  ["male", "1", "no", 1, 8588, 749, 1125],
  ["male", "1", "frequent", 8, 8838, 749, 829],
  ["female", "1", "frequent", 8, 8838, 749, 829],
  ["male", "1", "heavy", 8, 8838, 749, 829],
  ["female", "1", "moderate", 6, 8590, 749, 1125],
  ["female", "3", "no", 7, 8327, 999, 1100],
  ["female", "3", "moderate", 7, 8327, 999, 1100],
  ["female", "2", "no", 6, 8590, 749, 1125],
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

console.log(`ok ${cases.length} routing cases`);
