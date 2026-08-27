import {
  normalizeLocalPhone,
  sanitizePhoneInput,
  formatInternationalPhone,
  leadContactKeys,
} from "./phone.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const cases = [
  ["7200578069", "7200578069", "bare 10-digit"],
  ["+91 7200578069", "7200578069", "plus 91 with space"],
  ["917200578069", "7200578069", "91 prefix 12-digit"],
  ["0917200578069", "7200578069", "0 + 91 + 10"],
  ["07200578069", "7200578069", "trunk 0 + 10"],
  ["00917200578069", "7200578069", "00 international prefix"],
  ["91 7200 578069", "7200578069", "spaced 91 prefix"],
  ["9123456789", "9123456789", "valid 10-digit starting with 91"],
  ["+91 9123456789", "9123456789", "cc + number that itself starts with 91"],
];

for (const [raw, expected, label] of cases) {
  const got = normalizeLocalPhone(raw, "+91");
  assert(got === expected, `${label}: expected ${expected}, got ${got} (from ${raw})`);
}

assert(
  normalizeLocalPhone("917200578069") !== "9172005780",
  "must not keep the first 10 digits of +91 + local"
);

assert(formatInternationalPhone("917200578069") === "+91 7200578069", "intl format");
assert(formatInternationalPhone("7200578069", "+91") === "+91 7200578069", "intl from local");

const keysA = leadContactKeys({
  whatsapp: "+91 7200578069",
  email: "deepak@example.com",
});
const keysB = leadContactKeys({
  whatsapp: "7200578069",
  email: "Deepak@example.com",
});
assert(keysA.includes("phone:7200578069"), `phone key missing: ${keysA}`);
assert(keysA.includes("email:deepak@example.com"), `email key missing: ${keysA}`);
assert(
  keysA.join("|") === keysB.join("|"),
  `identity should match across phone formats: ${keysA} vs ${keysB}`
);

assert(
  sanitizePhoneInput("63803803177") === "6380380317",
  "typing an 11th digit must keep the first 10, not slide the number"
);
assert(sanitizePhoneInput("72005780691") === "7200578069", "cap at 10 from the start");

console.log(`ok ${cases.length} phone cases + identity keys`);
