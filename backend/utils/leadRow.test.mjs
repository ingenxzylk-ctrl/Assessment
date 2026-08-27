import { extraLeadCells, formatKitName } from "./leadRow.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const extra = extraLeadCells({
  aboutMe: {
    pincode: "600001",
    city: "Chennai",
    state: "Tamil Nadu",
  },
  reportMeta: {
    recommendedBundle: {
      bundleTitle: "Stage 4 Hair Regrowth Kit",
      kitUrl: "https://zylkhealth.com/?p=8596",
      wooProductId: 8596,
    },
  },
});

assert(extra.length === 6, `expected 6 extra cells, got ${extra.length}`);
assert(extra[0] === "600001", "pincode");
assert(extra[1] === "Chennai", "city");
assert(extra[2] === "Tamil Nadu", "state");
assert(extra[3] === "Stage 4 Hair Regrowth Kit", "kit name");
assert(extra[4] === "No", "purchased default");
assert(
  formatKitName({
    recommendedBundle: { bundleTitle: "Women Advance Hair Regrowth Kit" },
  }) === "Women Advance Hair Regrowth Kit",
  "kit name helper"
);
assert(
  extra[3] !== "https://zylkhealth.com/?p=8596",
  "kit name is not the product URL"
);

console.log("ok lead extra columns");
