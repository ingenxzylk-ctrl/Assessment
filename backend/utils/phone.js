/**
 * Indian WhatsApp / mobile normalization.
 * Keep in sync with frontend/src/utils/phone.js
 *
 * The quiz field is a 10-digit local number with a separate country-code
 * dropdown. Autofill/paste of "+91 7200578069" used to keep the *first* 10
 * digits ("9172005780") and drop the real suffix. Strip the country code /
 * trunk 0 first, then keep 10 local digits.
 */

export function digitsOnly(raw) {
  return String(raw ?? "").replace(/\D/g, "");
}

/**
 * @param {unknown} raw
 * @param {string} [countryCode="+91"]
 * @param {number} [maxDigits=10]
 * @returns {string} local/national digits only
 */
export function normalizeLocalPhone(raw, countryCode = "+91", maxDigits = 10) {
  let digits = digitsOnly(raw);
  if (!digits) return "";

  if (digits.startsWith("00")) digits = digits.slice(2);

  const cc = digitsOnly(countryCode) || "91";

  // 91XXXXXXXXXX (or other cc + local) — only strip when extra digits are present
  // so a real 10-digit mobile that starts with 91 (e.g. 9123456789) is kept.
  if (digits.length > maxDigits && digits.startsWith(cc)) {
    digits = digits.slice(cc.length);
  }

  // India trunk prefix: 0XXXXXXXXXX
  if (cc === "91" && digits.length === maxDigits + 1 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length > maxDigits) {
    digits = digits.slice(-maxDigits);
  }

  return digits.slice(0, maxDigits);
}

export function formatInternationalPhone(raw, countryCode = "+91") {
  const local = normalizeLocalPhone(raw, countryCode);
  if (!local) return "";
  const code = String(countryCode || "+91").trim() || "+91";
  const codeNorm = code.startsWith("+") ? code : `+${digitsOnly(code) || "91"}`;
  return `${codeNorm} ${local}`;
}

/** Google Sheets: leading apostrophe so "+" is not treated as a formula. */
export function formatPhoneForSheets(aboutMe = {}) {
  const display = formatInternationalPhone(
    aboutMe.whatsapp || aboutMe.phone || aboutMe.mobile,
    aboutMe.countryCode || "+91"
  );
  return display ? `'${display}` : "";
}

/**
 * Stable lead contact keys (not quiz answers).
 * Phone and email are stored as separate keys so a truncated phone with the
 * same email still collapses to one report within the reuse window.
 */
export function leadContactKeys(aboutMe = {}) {
  const phone = normalizeLocalPhone(
    aboutMe.whatsapp || aboutMe.phone || aboutMe.mobile,
    aboutMe.countryCode || "+91"
  );
  const email = String(aboutMe.email || aboutMe.emailAddress || "")
    .trim()
    .toLowerCase();
  const keys = [];
  if (phone.length >= 10) keys.push(`phone:${phone}`);
  if (email.includes("@")) keys.push(`email:${email}`);
  return keys;
}
