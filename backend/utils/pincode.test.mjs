import {
  isValidIndianPincode,
  normalizeIndianPincode,
  extractIndianPincode,
} from "./pincode.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizeIndianPincode("600001") === "600001", "bare pin");
assert(normalizeIndianPincode("600 001") === "600001", "spaced pin");
assert(normalizeIndianPincode("060001") === "060001", "keep 6 including leading 0 then reject");
assert(!isValidIndianPincode("060001"), "cannot start with 0");
assert(!isValidIndianPincode("60001"), "5 digits invalid");
assert(normalizeIndianPincode("6000011") === "600001", "extra digits sliced");
assert(isValidIndianPincode("600001"), "chennai pin");
assert(isValidIndianPincode("720057"), "valid first digit 7");
assert(!isValidIndianPincode(""), "empty");

assert(extractIndianPincode("600001") === "600001", "plain pin");
assert(extractIndianPincode("Chennai 600 001 Tamil Nadu") === "600001", "spaced pin in address");
assert(extractIndianPincode("No postcode here") === "", "no pin");

console.log("ok pincode validation");
