/** Indian PIN: 6 digits, first digit 1–9. Keep in sync with frontend/src/utils/pincode.js */

export function normalizeIndianPincode(raw) {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 6);
}

export function isValidIndianPincode(raw) {
  return /^[1-9][0-9]{5}$/.test(normalizeIndianPincode(raw));
}
