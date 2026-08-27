import {
  isValidIndianPincode,
  normalizeIndianPincode,
} from "./pincode.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizeIndianPincode("600 001 extra") === "600001", "slice to 6");
assert(isValidIndianPincode("110001"), "delhi");
assert(!isValidIndianPincode("12345"), "too short");

console.log("ok frontend pincode");
