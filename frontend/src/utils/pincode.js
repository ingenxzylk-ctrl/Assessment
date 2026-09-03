/** Indian PIN: 6 digits, first digit 1–9. Keep in sync with backend/utils/pincode.js */

export function normalizeIndianPincode(raw) {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 6);
}

export function isValidIndianPincode(raw) {
  return /^[1-9][0-9]{5}$/.test(normalizeIndianPincode(raw));
}

/** First 6-digit Indian PIN found in free text (geocoder postcode / display name). */
export function extractIndianPincode(raw) {
  const text = String(raw ?? "");
  const spaced = text.match(/\b([1-9]\d{2})\s*(\d{3})\b/);
  if (spaced) {
    const pin = `${spaced[1]}${spaced[2]}`;
    if (isValidIndianPincode(pin)) return pin;
  }
  const match = text.match(/\b([1-9][0-9]{5})\b/);
  return match && isValidIndianPincode(match[1]) ? match[1] : "";
}
